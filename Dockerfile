FROM php:8.4-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip \
    libicu-dev \
    libpq-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions required by Craft CMS
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
    pdo \
    pdo_mysql \
    mbstring \
    exif \
    pcntl \
    bcmath \
    gd \
    intl \
    zip \
    opcache

# Install ImageMagick
RUN apt-get update && apt-get install -y \
    libmagickwand-dev --no-install-recommends \
    && pecl install imagick \
    && docker-php-ext-enable imagick \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Configure PHP settings for production
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && echo "memory_limit = 512M" >> "$PHP_INI_DIR/conf.d/craft.ini" \
    && echo "max_execution_time = 300" >> "$PHP_INI_DIR/conf.d/craft.ini" \
    && echo "upload_max_filesize = 100M" >> "$PHP_INI_DIR/conf.d/craft.ini" \
    && echo "post_max_size = 100M" >> "$PHP_INI_DIR/conf.d/craft.ini" \
    && echo "opcache.enable=1" >> "$PHP_INI_DIR/conf.d/opcache.ini" \
    && echo "opcache.memory_consumption=256" >> "$PHP_INI_DIR/conf.d/opcache.ini" \
    && echo "opcache.interned_strings_buffer=16" >> "$PHP_INI_DIR/conf.d/opcache.ini" \
    && echo "opcache.max_accelerated_files=10000" >> "$PHP_INI_DIR/conf.d/opcache.ini" \
    && echo "opcache.validate_timestamps=0" >> "$PHP_INI_DIR/conf.d/opcache.ini"

# Copy application files (excluding vendor - see .dockerignore)
COPY . /var/www/html


# Create writable home directory for www-data and configure git
RUN mkdir -p /home/www-data \
    && chown -R www-data:www-data /home/www-data \
    && usermod -d /home/www-data www-data \
    && git config --global --add safe.directory /var/www/html \
    && su www-data -s /bin/sh -c "git config --global --add safe.directory /var/www/html"

# Set HOME environment variable for www-data
ENV HOME=/home/www-data

# Create Craft runtime directories and set ownership BEFORE installing composer
# Note: With bind mounts, these directories will be on the host filesystem
RUN mkdir -p /var/www/html/storage/runtime \
    /var/www/html/storage/logs \
    /var/www/html/storage/backups \
    /var/www/html/vendor \
    /var/www/html/web/cpresources \
    /var/www/html/config/project \
    && chown -R www-data:www-data \
    /var/www/html/storage \
    /var/www/html/vendor \
    /var/www/html/web/cpresources \
    /var/www/html/config \
    /var/www/html/.env \
    && chmod -R 775 \
    /var/www/html/storage \
    /var/www/html/vendor \
    /var/www/html/web/cpresources \
    /var/www/html/config \
    && chmod 664 /var/www/html/.env

# Install composer dependencies as www-data user
RUN su www-data -s /bin/sh -c "composer install --no-dev --optimize-autoloader --no-interaction"

# Fix permissions one final time after composer install
RUN chown -R www-data:www-data \
    /var/www/html/storage \
    /var/www/html/vendor \
    /var/www/html/web/cpresources \
    /var/www/html/config \
    /var/www/html/.env \
    && chmod -R 775 \
    /var/www/html/storage \
    /var/www/html/vendor \
    /var/www/html/web/cpresources \
    /var/www/html/config \
    && chmod 664 /var/www/html/.env

# Create a simple entrypoint script to fix permissions on startup
RUN echo '#!/bin/sh' > /docker-entrypoint.sh \
    && echo 'set -e' >> /docker-entrypoint.sh \
    && echo '# Only change ownership of writable directories' >> /docker-entrypoint.sh \
    && echo 'chown -R www-data:www-data /var/www/html/storage /var/www/html/web/cpresources 2>/dev/null || true' >> /docker-entrypoint.sh \
    && echo 'chown www-data:www-data /var/www/html/.env 2>/dev/null || true' >> /docker-entrypoint.sh \
    && echo 'chmod -R 775 /var/www/html/storage /var/www/html/web/cpresources 2>/dev/null || true' >> /docker-entrypoint.sh \
    && echo 'chmod 664 /var/www/html/.env 2>/dev/null || true' >> /docker-entrypoint.sh \
    && echo 'exec "$@"' >> /docker-entrypoint.sh \
    && chmod +x /docker-entrypoint.sh

# Expose port 9000 for PHP-FPM
EXPOSE 9000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["php-fpm"]
