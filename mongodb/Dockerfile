FROM mongo:8

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create bitnami-compatible directory structure
RUN mkdir -p /bitnami/mongodb/data /bitnami/mongodb/conf /bitnami/mongodb/logs \
    && chown -R mongodb:mongodb /bitnami

ENTRYPOINT ["/entrypoint.sh"]
