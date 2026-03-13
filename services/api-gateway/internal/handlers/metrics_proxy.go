package handlers

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

func metricsServiceURL() string {
	if u := os.Getenv("BACKFORGE_METRICS_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:8085"
}

// MetricsProxy forwards /metrics/* requests to the metrics service.
func MetricsProxy(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Path
	if target == "" {
		target = "/"
	}

	proxyURL, err := url.Parse(metricsServiceURL() + target)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "invalid metrics service URL")
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
		errorJSON(w, http.StatusBadGateway, "metrics service unavailable")
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body) //nolint:errcheck
}
