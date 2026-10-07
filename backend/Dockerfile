FROM php:8.4-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
        libsqlite3-dev \
        libzip-dev \
        libonig-dev \
        libcurl4-openssl-dev \
        unzip \
    && docker-php-ext-install pdo_sqlite zip mbstring bcmath curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader

COPY . .
RUN php artisan package:discover --ansi && composer dump-autoload --optimize

RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 10000

CMD sh -c "touch /app/storage/database.sqlite && php artisan migrate --force && (php artisan db:seed --force || echo 'seed skipped') && php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"
