package handlers

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

func syncServiceURL() string {
	if u := os.Getenv("BACKFORGE_SYNC_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:8083"
}

// SyncProxy forwards requests to the sync-server service.
// /sync/{project} → /sync/{project} (no prefix stripping needed)
func SyncProxy(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Path
	if target == "" {
		target = "/"
	}

	proxyURL, err := url.Parse(syncServiceURL() + target)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "invalid sync service URL")
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
	for _, h := range []string{"Content-Type", "Accept", "Authorization"} {
		if v := r.Header.Get(h); v != "" {
			proxyReq.Header.Set(h, v)
		}
	}

	resp, err := http.DefaultClient.Do(proxyReq)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "sync service unavailable")
		return
	}
	defer resp.Body.Close()

	for k, vs := range resp.Header {
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body) //nolint:errcheck
}
