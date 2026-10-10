FROM alpine:3.21
RUN apk add --no-cache openssh-client && adduser -D -u 1000 edge
USER 1000:1000
ENTRYPOINT ["ssh"]
