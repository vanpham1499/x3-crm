ARG BASE_IMAGE
FROM ${BASE_IMAGE}
USER root
WORKDIR /app
# Reuse dependencies only after proving that the lockfile matches the base image.
COPY composer.lock /tmp/release-composer.lock
RUN cmp composer.lock /tmp/release-composer.lock && rm /tmp/release-composer.lock
COPY app app
COPY bootstrap bootstrap
COPY config config
COPY database database
COPY routes routes
COPY docker docker
COPY artisan composer.json composer.lock ./
ARG UPLOAD_LIMIT=256M
ARG POST_LIMIT=260M
RUN printf 'upload_max_filesize=%s\npost_max_size=%s\n' "$UPLOAD_LIMIT" "$POST_LIMIT" > /usr/local/etc/php/conf.d/release-upload.ini \
 && sed -i 's/\r$//' docker/zalo-entrypoint.sh && chmod 755 docker/zalo-entrypoint.sh \
 && rm -f bootstrap/cache/*.php \
 && php artisan package:discover --ansi \
 && chown -R www-data:www-data storage bootstrap/cache
