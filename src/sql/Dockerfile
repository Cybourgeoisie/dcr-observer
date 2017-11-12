FROM postgres:9.6.5

COPY setup /docker-entrypoint-initdb.d/

VOLUME ["/etc/postgresql", "/var/log/postgresql", "/var/lib/postgresql"]

# Development
ENV POSTGRES_USER dcraudit_admin
ENV POSTGRES_PASSWORD dcraudit_admin_pass
ENV POSTGRES_DB dcraudit

CMD ["postgres"]