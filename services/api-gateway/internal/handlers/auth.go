package handlers

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/backforge/api-gateway/internal/config"
	"github.com/backforge/api-gateway/internal/middleware"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler holds dependencies for all auth endpoints.
type AuthHandler struct {
	pool *pgxpool.Pool
	rdb  *redis.Client
	cfg  *config.Config
}

// NewAuthHandler creates an AuthHandler and auto-migrates the users/project_registry schema.
func NewAuthHandler(pool *pgxpool.Pool, rdb *redis.Client, cfg *config.Config) (*AuthHandler, error) {
	h := &AuthHandler{pool: pool, rdb: rdb, cfg: cfg}
	if err := h.initSchema(context.Background()); err != nil {
		return nil, fmt.Errorf("auth schema init: %w", err)
	}
	return h, nil
}

// initSchema creates the users and project_registry tables if they don't already exist.
func (h *AuthHandler) initSchema(ctx context.Context) error {
	_, err := h.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS users (
			id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			username        VARCHAR(50) UNIQUE NOT NULL,
			email           VARCHAR(255) UNIQUE NOT NULL,
			password_hash   TEXT,
			github_id       BIGINT UNIQUE,
			github_username VARCHAR(100),
			github_email    VARCHAR(255),
			created_at      TIMESTAMPTZ DEFAULT NOW(),
			updated_at      TIMESTAMPTZ DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
		CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

		CREATE TABLE IF NOT EXISTS project_registry (
			id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name       VARCHAR(255) NOT NULL,
			created_at TIMESTAMPTZ  DEFAULT NOW(),
			UNIQUE(user_id, name)
		);
		CREATE INDEX IF NOT EXISTS idx_project_registry_user_id ON project_registry(user_id);

		CREATE TABLE IF NOT EXISTS oauth_provider_configs (
			id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			project_id        UUID REFERENCES project_registry(id) ON DELETE CASCADE,
			provider          VARCHAR(50) NOT NULL,
			scope_type        VARCHAR(20) NOT NULL,
			scope_key         TEXT NOT NULL,
			client_id         TEXT NOT NULL,
			client_secret_enc TEXT NOT NULL,
			callback_url      TEXT NOT NULL,
			created_at        TIMESTAMPTZ DEFAULT NOW(),
			updated_at        TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(user_id, provider, scope_key)
		);
		CREATE INDEX IF NOT EXISTS idx_oauth_provider_configs_user_id   ON oauth_provider_configs(user_id);
		CREATE INDEX IF NOT EXISTS idx_oauth_provider_configs_project_id ON oauth_provider_configs(project_id);

		CREATE TABLE IF NOT EXISTS platform_configs (
			key        TEXT        PRIMARY KEY,
			value      TEXT        NOT NULL,
			updated_at TIMESTAMPTZ DEFAULT NOW()
		);

		ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
	`)
	return err
}

// ── data types ────────────────────────────────────────────────────────────────

type userRow struct {
	ID             string
	Username       string
	Email          string
	PasswordHash   *string
	GitHubID       *int64
	GitHubUsername *string
	GitHubEmail    *string
	Role           string
}

// UserResponse is the public representation of a user (no password hash).
type UserResponse struct {
	ID             string  `json:"id"`
	Username       string  `json:"username"`
	Email          string  `json:"email"`
	GitHubUsername *string `json:"github_username,omitempty"`
	GitHubEmail    *string `json:"github_email,omitempty"`
	HasPassword    bool    `json:"has_password"`
	HasGitHub      bool    `json:"has_github"`
	Role           string  `json:"role"`
}

func toResponse(u userRow) UserResponse {
	return UserResponse{
		ID:             u.ID,
		Username:       u.Username,
		Email:          u.Email,
		GitHubUsername: u.GitHubUsername,
		GitHubEmail:    u.GitHubEmail,
		HasPassword:    u.PasswordHash != nil,
		HasGitHub:      u.GitHubID != nil,
		Role:           u.Role,
	}
}

func (h *AuthHandler) generateJWT(userID, role string) (string, error) {
	claims := &middleware.Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (h *AuthHandler) platformGitHubConfigured() bool {
	return h.cfg.PlatformGitHubClientID != "" && h.cfg.PlatformGitHubClientSecret != ""
}

func (h *AuthHandler) encryptSecret(raw string) (string, error) {
	key := sha256.Sum256([]byte(h.cfg.OAuthSecretsKey))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(raw), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

func scopeKey(projectID *string) string {
	if projectID == nil || strings.TrimSpace(*projectID) == "" {
		return "account"
	}
	return "project:" + strings.TrimSpace(*projectID)
}

func scopeType(projectID *string) string {
	if projectID == nil || strings.TrimSpace(*projectID) == "" {
		return "account"
	}
	return "project"
}

func normalizeOptionalUUID(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func pointerToString(value string) *string {
	return &value
}

func (h *AuthHandler) validateProjectOwnership(ctx context.Context, userID string, projectID *string) error {
	if projectID == nil {
		return nil
	}
	var exists bool
	err := h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM project_registry WHERE id = $1 AND user_id = $2)`, *projectID, userID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("project not found or not owned by user")
	}
	return nil
}

func scanUser(row pgx.Row) (userRow, error) {
	var u userRow
	err := row.Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash,
		&u.GitHubID, &u.GitHubUsername, &u.GitHubEmail, &u.Role)
	return u, err
}

const selectUser = `SELECT id, username, email, password_hash, github_id, github_username, github_email, role FROM users`

// ── Register ─────────────────────────────────────────────────────────────────

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Register handles POST /auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Username == "" || req.Email == "" || req.Password == "" {
		errorJSON(w, http.StatusBadRequest, "username, email and password are required")
		return
	}
	if len(req.Username) < 3 || len(req.Username) > 50 {
		errorJSON(w, http.StatusBadRequest, "username must be between 3 and 50 characters")
		return
	}
	if len(req.Password) < 8 {
		errorJSON(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if !strings.Contains(req.Email, "@") || !strings.Contains(req.Email, ".") {
		errorJSON(w, http.StatusBadRequest, "invalid email address")
		return
	}

	ctx := r.Context()

	// Check username uniqueness
	var exists bool
	if err := h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, req.Username).Scan(&exists); err != nil {
		errorJSON(w, http.StatusInternalServerError, "database error")
		return
	}
	if exists {
		errorJSON(w, http.StatusConflict, "username already taken")
		return
	}

	// Check email uniqueness
	if err := h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, req.Email).Scan(&exists); err != nil {
		errorJSON(w, http.StatusInternalServerError, "database error")
		return
	}
	if exists {
		errorJSON(w, http.StatusConflict, "email already registered")
		return
	}

	// Hash password (bcrypt cost 12)
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	// First registered user becomes admin
	var userCount int
	if err := h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&userCount); err != nil {
		errorJSON(w, http.StatusInternalServerError, "database error")
		return
	}
	role := "user"
	if userCount == 0 {
		role = "admin"
	}

	// Create user — DB generates the UUID
	u, err := scanUser(h.pool.QueryRow(ctx, `
		INSERT INTO users (username, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, email, password_hash, github_id, github_username, github_email, role
	`, req.Username, req.Email, string(hash), role))
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	token, err := h.generateJWT(u.ID, u.Role)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": toResponse(u), "token": token})
}

// ── Login ─────────────────────────────────────────────────────────────────────

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login handles POST /auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		errorJSON(w, http.StatusBadRequest, "email and password are required")
		return
	}

	ctx := r.Context()

	u, err := scanUser(h.pool.QueryRow(ctx, selectUser+` WHERE email = $1`, req.Email))
	if err != nil {
		// Use opaque message to prevent user enumeration
		errorJSON(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if u.PasswordHash == nil {
		errorJSON(w, http.StatusUnauthorized, "this account uses GitHub login — no password set")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*u.PasswordHash), []byte(req.Password)); err != nil {
		errorJSON(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := h.generateJWT(u.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": toResponse(u), "token": token})
}

// ── GetMe ─────────────────────────────────────────────────────────────────────

// GetMe handles GET /auth/me (protected — JWT required)
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(middleware.UserClaimsKey).(*middleware.Claims)
	u, err := scanUser(h.pool.QueryRow(r.Context(), selectUser+` WHERE id = $1`, claims.UserID))
	if err != nil {
		errorJSON(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, toResponse(u))
}

// PlatformGitHubStatus reports whether platform-level GitHub OAuth is configured.
// This is used only for logging into BackForge itself, not for user-owned public apps.
func (h *AuthHandler) PlatformGitHubStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"provider":   "github",
		"configured": h.platformGitHubConfigured(),
		"scope":      "platform",
	})
}

// GetGitHubProviderConfig returns the GitHub OAuth app config stored for the current user.
// If project_id is provided, the config is scoped to that project; otherwise it is account-wide.
func (h *AuthHandler) GetGitHubProviderConfig(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(middleware.UserClaimsKey).(*middleware.Claims)
	projectID := normalizeOptionalUUID(pointerToString(r.URL.Query().Get("project_id")))
	if err := h.validateProjectOwnership(r.Context(), claims.UserID, projectID); err != nil {
		errorJSON(w, http.StatusForbidden, err.Error())
		return
	}

	response := providerConfigResponse{
		Provider:           "github",
		ScopeType:          scopeType(projectID),
		ProjectID:          projectID,
		Configured:         false,
		HasSecret:          false,
		PlatformConfigured: h.platformGitHubConfigured(),
	}

	var clientID string
	var callbackURL string
	var hasSecret bool
	err := h.pool.QueryRow(r.Context(), `
		SELECT client_id, callback_url, client_secret_enc <> ''
		FROM oauth_provider_configs
		WHERE user_id = $1 AND provider = 'github' AND scope_key = $2
	`, claims.UserID, scopeKey(projectID)).Scan(&clientID, &callbackURL, &hasSecret)
	if err == nil {
		response.Configured = true
		response.ClientID = clientID
		response.CallbackURL = callbackURL
		response.HasSecret = hasSecret
	}

	writeJSON(w, http.StatusOK, response)
}

// UpsertGitHubProviderConfig stores user-owned GitHub OAuth app credentials encrypted in the database.
// These credentials are for the user's generated/public apps, not for BackForge platform sign-in.
func (h *AuthHandler) UpsertGitHubProviderConfig(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(middleware.UserClaimsKey).(*middleware.Claims)

	var req upsertProviderConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.ProjectID = normalizeOptionalUUID(req.ProjectID)
	req.ClientID = strings.TrimSpace(req.ClientID)
	req.ClientSecret = strings.TrimSpace(req.ClientSecret)
	req.CallbackURL = strings.TrimSpace(req.CallbackURL)

	if req.ClientID == "" || req.ClientSecret == "" || req.CallbackURL == "" {
		errorJSON(w, http.StatusBadRequest, "client_id, client_secret and callback_url are required")
		return
	}
	if err := h.validateProjectOwnership(r.Context(), claims.UserID, req.ProjectID); err != nil {
		errorJSON(w, http.StatusForbidden, err.Error())
		return
	}

	secretEnc, err := h.encryptSecret(req.ClientSecret)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "failed to encrypt client secret")
		return
	}

	_, err = h.pool.Exec(r.Context(), `
		INSERT INTO oauth_provider_configs (user_id, project_id, provider, scope_type, scope_key, client_id, client_secret_enc, callback_url, updated_at)
		VALUES ($1, $2, 'github', $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (user_id, provider, scope_key)
		DO UPDATE SET
			project_id = EXCLUDED.project_id,
			scope_type = EXCLUDED.scope_type,
			client_id = EXCLUDED.client_id,
			client_secret_enc = EXCLUDED.client_secret_enc,
			callback_url = EXCLUDED.callback_url,
			updated_at = NOW()
	`, claims.UserID, req.ProjectID, scopeType(req.ProjectID), scopeKey(req.ProjectID), req.ClientID, secretEnc, req.CallbackURL)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "failed to save provider config")
		return
	}

	writeJSON(w, http.StatusOK, providerConfigResponse{
		Provider:           "github",
		ScopeType:          scopeType(req.ProjectID),
		ProjectID:          req.ProjectID,
		Configured:         true,
		ClientID:           req.ClientID,
		CallbackURL:        req.CallbackURL,
		HasSecret:          true,
		PlatformConfigured: h.platformGitHubConfigured(),
	})
}

// ── GitHub OAuth types ────────────────────────────────────────────────────────

type oauthState struct {
	Mode   string `json:"mode"`    // "login" | "register" | "connect"
	UserID string `json:"user_id"` // populated only for "connect"
}

type githubUser struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
	Email string `json:"email"`
}

type providerConfigResponse struct {
	Provider           string  `json:"provider"`
	ScopeType          string  `json:"scope_type"`
	ProjectID          *string `json:"project_id,omitempty"`
	Configured         bool    `json:"configured"`
	ClientID           string  `json:"client_id,omitempty"`
	CallbackURL        string  `json:"callback_url,omitempty"`
	HasSecret          bool    `json:"has_secret"`
	PlatformConfigured bool    `json:"platform_configured"`
}

type upsertProviderConfigRequest struct {
	ProjectID    *string `json:"project_id"`
	ClientID     string  `json:"client_id"`
	ClientSecret string  `json:"client_secret"`
	CallbackURL  string  `json:"callback_url"`
}

// ── GitHubAuthorize ───────────────────────────────────────────────────────────

// GitHubAuthorize handles GET /auth/github?mode=login|register
// Redirects the browser to the GitHub OAuth consent page.
func (h *AuthHandler) GitHubAuthorize(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "login"
	}
	if mode != "login" && mode != "register" {
		errorJSON(w, http.StatusBadRequest, "mode must be 'login' or 'register'")
		return
	}
	if !h.platformGitHubConfigured() {
		h.redirectError(w, r, "platform_github_not_configured")
		return
	}

	h.startGitHubFlow(w, r, oauthState{Mode: mode})
}

// GitHubConnectInit handles POST /auth/github/connect (protected — JWT required).
// Returns the GitHub authorization URL so the frontend can redirect the user.
func (h *AuthHandler) GitHubConnectInit(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(middleware.UserClaimsKey).(*middleware.Claims)
	if !h.platformGitHubConfigured() {
		errorJSON(w, http.StatusServiceUnavailable, "GitHub OAuth not configured")
		return
	}

	stateKey, err := h.storeState(r.Context(), oauthState{Mode: "connect", UserID: claims.UserID})
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "state storage failed")
		return
	}
	authURL := h.buildGitHubURL(stateKey)
	writeJSON(w, http.StatusOK, map[string]string{"url": authURL})
}

// startGitHubFlow stores OAuth state and redirects to GitHub.
func (h *AuthHandler) startGitHubFlow(w http.ResponseWriter, r *http.Request, state oauthState) {
	stateKey, err := h.storeState(r.Context(), state)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "state storage failed")
		return
	}
	http.Redirect(w, r, h.buildGitHubURL(stateKey), http.StatusFound)
}

func (h *AuthHandler) storeState(ctx context.Context, state oauthState) (string, error) {
	stateJSON, _ := json.Marshal(state)
	key, err := randomHex(16)
	if err != nil {
		return "", err
	}
	if err := h.rdb.Set(ctx, "auth:state:"+key, stateJSON, 10*time.Minute).Err(); err != nil {
		return "", err
	}
	return key, nil
}

func (h *AuthHandler) buildGitHubURL(stateKey string) string {
	return fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&state=%s&scope=user:email",
		url.QueryEscape(h.cfg.PlatformGitHubClientID),
		url.QueryEscape(h.cfg.PlatformGitHubCallbackURL),
		url.QueryEscape(stateKey),
	)
}

// ── GitHubCallback ────────────────────────────────────────────────────────────

// GitHubCallback handles GET /auth/github/callback
func (h *AuthHandler) GitHubCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	stateKey := r.URL.Query().Get("state")
	if code == "" || stateKey == "" {
		h.redirectError(w, r, "oauth_failed")
		return
	}

	ctx := r.Context()

	// Retrieve state (one-time use — delete on read)
	raw, err := h.rdb.GetDel(ctx, "auth:state:"+stateKey).Bytes()
	if err != nil {
		h.redirectError(w, r, "invalid_state")
		return
	}
	var state oauthState
	if err := json.Unmarshal(raw, &state); err != nil {
		h.redirectError(w, r, "invalid_state")
		return
	}

	// Exchange code for access token
	ghToken, err := h.exchangeCode(ctx, code)
	if err != nil {
		h.redirectError(w, r, "oauth_failed")
		return
	}

	// Fetch GitHub user profile
	gh, err := h.fetchGitHubUser(ctx, ghToken)
	if err != nil {
		h.redirectError(w, r, "github_api_failed")
		return
	}

	switch state.Mode {
	case "login":
		h.githubLogin(w, r, ctx, gh)
	case "register":
		h.githubRegister(w, r, ctx, gh)
	case "connect":
		h.githubConnect(w, r, ctx, gh, state.UserID)
	default:
		h.redirectError(w, r, "invalid_mode")
	}
}

// githubLogin finds an existing user by GitHub ID and issues a JWT.
func (h *AuthHandler) githubLogin(w http.ResponseWriter, r *http.Request, ctx context.Context, gh githubUser) {
	u, err := scanUser(h.pool.QueryRow(ctx, selectUser+` WHERE github_id = $1`, gh.ID))
	if err != nil {
		h.redirectError(w, r, "github_not_registered")
		return
	}
	token, err := h.generateJWT(u.ID)
	if err != nil {
		h.redirectError(w, r, "token_failed")
		return
	}
	h.redirectToken(w, r, token)
}

// githubRegister creates a new account linked to a GitHub identity.
func (h *AuthHandler) githubRegister(w http.ResponseWriter, r *http.Request, ctx context.Context, gh githubUser) {
	var exists bool

	// Reject if GitHub ID already linked to any account
	if err := h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE github_id = $1)`, gh.ID).Scan(&exists); err != nil {
		h.redirectError(w, r, "db_error")
		return
	}
	if exists {
		h.redirectError(w, r, "github_already_registered")
		return
	}

	// Reject if the GitHub primary email is already used by a different account
	ghEmail := strings.ToLower(gh.Email)
	if ghEmail != "" {
		if err := h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, ghEmail).Scan(&exists); err != nil {
			h.redirectError(w, r, "db_error")
			return
		}
		if exists {
			h.redirectError(w, r, "email_already_registered")
			return
		}
	}

	// Derive a unique username from the GitHub login
	username := gh.Login
	if err := h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists); err != nil {
		h.redirectError(w, r, "db_error")
		return
	}
	if exists {
		suffix, _ := randomHex(3)
		username = username + "_" + suffix
	}

	// Fall back to a synthetic email if GitHub didn't provide one
	email := ghEmail
	if email == "" {
		email = fmt.Sprintf("github+%d@users.backforge.local", gh.ID)
	}

	u, err := scanUser(h.pool.QueryRow(ctx, `
		INSERT INTO users (username, email, github_id, github_username, github_email)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, username, email, password_hash, github_id, github_username, github_email
	`, username, email, gh.ID, gh.Login, ghEmail))
	if err != nil {
		h.redirectError(w, r, "register_failed")
		return
	}

	token, err := h.generateJWT(u.ID)
	if err != nil {
		h.redirectError(w, r, "token_failed")
		return
	}
	h.redirectToken(w, r, token)
}

// githubConnect links a GitHub identity to an already-authenticated account.
func (h *AuthHandler) githubConnect(w http.ResponseWriter, r *http.Request, ctx context.Context, gh githubUser, userID string) {
	// Block if GitHub ID is already owned by a DIFFERENT user
	var existingOwner string
	err := h.pool.QueryRow(ctx, `SELECT id FROM users WHERE github_id = $1`, gh.ID).Scan(&existingOwner)
	if err == nil && existingOwner != userID {
		h.redirectError(w, r, "github_already_linked")
		return
	}

	_, dbErr := h.pool.Exec(ctx, `
		UPDATE users
		SET github_id = $1, github_username = $2, github_email = $3, updated_at = NOW()
		WHERE id = $4
	`, gh.ID, gh.Login, strings.ToLower(gh.Email), userID)
	if dbErr != nil {
		h.redirectError(w, r, "connect_failed")
		return
	}

	http.Redirect(w, r, h.cfg.FrontendURL+"/settings?github_connected=true", http.StatusFound)
}

// ── GitHub HTTP helpers ───────────────────────────────────────────────────────

func (h *AuthHandler) exchangeCode(ctx context.Context, code string) (string, error) {
	body := url.Values{
		"client_id":     {h.cfg.PlatformGitHubClientID},
		"client_secret": {h.cfg.PlatformGitHubClientSecret},
		"code":          {code},
		"redirect_uri":  {h.cfg.PlatformGitHubCallbackURL},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://github.com/login/oauth/access_token",
		strings.NewReader(body.Encode()),
	)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("github oauth error: %s", result.Error)
	}
	return result.AccessToken, nil
}

func (h *AuthHandler) fetchGitHubUser(ctx context.Context, token string) (githubUser, error) {
	var gh githubUser

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return gh, err
	}
	defer resp.Body.Close()

	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return gh, fmt.Errorf("github user API: status %d", resp.StatusCode)
	}
	if err := json.Unmarshal(b, &gh); err != nil {
		return gh, fmt.Errorf("decode github user: %w", err)
	}

	// Public email may be empty — fall back to verified primary email
	if gh.Email == "" {
		gh.Email = h.fetchPrimaryEmail(ctx, token)
	}
	return gh, nil
}

func (h *AuthHandler) fetchPrimaryEmail(ctx context.Context, token string) string {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user/emails", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return ""
	}
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email
		}
	}
	return ""
}

// ── Redirect helpers ──────────────────────────────────────────────────────────

func (h *AuthHandler) redirectToken(w http.ResponseWriter, r *http.Request, token string) {
	http.Redirect(w, r,
		fmt.Sprintf("%s/auth/callback?token=%s", h.cfg.FrontendURL, url.QueryEscape(token)),
		http.StatusFound,
	)
}

func (h *AuthHandler) redirectError(w http.ResponseWriter, r *http.Request, errCode string) {
	http.Redirect(w, r,
		fmt.Sprintf("%s/auth/callback?error=%s", h.cfg.FrontendURL, url.QueryEscape(errCode)),
		http.StatusFound,
	)
}
