FROM php:7.0.23-apache

RUN apt-get update && apt-get install -y libghc-postgresql-libpq-dev vim cron \
	&& docker-php-ext-configure pgsql -with-pgsql=/usr/include/postgresql/ \ 
	&& docker-php-ext-install pgsql pdo_pgsql

# Development
COPY config/apache-dev.conf /etc/apache2/sites-available/apache.conf

EXPOSE 80

VOLUME ["/var/log/apache2"]

RUN mkdir /var/www/cache/
RUN chmod 777 /var/www/cache/

RUN a2enmod rewrite
RUN a2ensite apache.conf
RUN a2dissite 000-default.conf

CMD ["/usr/sbin/apache2ctl", "-D", "FOREGROUND"]