FROM nginxinc/nginx-unprivileged:1.28-alpine

COPY --chown=101:101 index.html styles.css /usr/share/nginx/html/
COPY --chown=101:101 src/ /usr/share/nginx/html/src/
COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

USER 101