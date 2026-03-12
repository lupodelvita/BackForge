package handlers

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

func codegenServiceURL() string {
	if u := os.Getenv("BACKFORGE_CODEGEN_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:8084"
}

// CodegenProxy forwards requests to the code-generator service.
// /generate/sql|handlers|openapi|all → forwarded as-is
func CodegenProxy(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Path
	if target == "" {
		target = "/"
	}

	proxyURL, err := url.Parse(codegenServiceURL() + target)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "invalid codegen service URL")
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
		errorJSON(w, http.StatusBadGateway, "code-generator service unavailable")
		return
	}
	defer resp.Body.Close()

	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body) //nolint:errcheck
}
