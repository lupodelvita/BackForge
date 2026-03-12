package handlers

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

func deployServiceURL() string {
	if u := os.Getenv("BACKFORGE_DEPLOY_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:8082"
}

// DeployProxy forwards requests to the deployment service.
// Strips the /deploy prefix so /deploy/deployments/{id} → /deployments/{id}.
func DeployProxy(w http.ResponseWriter, r *http.Request) {
	// Strip the /deploy prefix
	target := strings.TrimPrefix(r.URL.Path, "/deploy")
	if target == "" {
		target = "/"
	}

	proxyURL, err := url.Parse(deployServiceURL() + target)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "invalid deploy service URL")
		return
	}
	if r.URL.RawQuery != "" {
		proxyURL.RawQuery = r.URL.RawQuery
	}

	proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, proxyURL.String(), r.Body)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "failed to build proxy request")
		return
	}
	// Forward relevant headers
	for _, h := range []string{"Content-Type", "Accept", "Authorization"} {
		if v := r.Header.Get(h); v != "" {
			proxyReq.Header.Set(h, v)
		}
	}

	resp, err := http.DefaultClient.Do(proxyReq)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "deployment service unavailable")
		return
	}
	defer resp.Body.Close()

	// Mirror status and body
	for k, vs := range resp.Header {
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body) //nolint:errcheck
}
