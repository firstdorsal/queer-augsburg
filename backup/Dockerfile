FROM python:3.8.16-alpine3.16

RUN apk update \
    && apk add --no-cache gcc musl-dev linux-headers \
    && pip install py7zr boto3 \
    && apk del gcc musl-dev linux-headers

#RUN adduser -D worker

COPY src /app
RUN mkdir /backup
COPY crontab /etc/crontabs/crontab

RUN chmod 0644 /etc/crontabs/crontab \
    && crontab /etc/crontabs/crontab

# Health check every 1.5h.
HEALTHCHECK --interval=129600s --timeout=10s --retries=3 CMD /usr/bin/env python3 /src/healthcheck.py

#USER worker
# Do not change.
CMD exec crond -f
