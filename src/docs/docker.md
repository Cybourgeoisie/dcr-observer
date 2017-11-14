# Using Docker

# Ways to debug:
	docker logs [container]


# Development Builds
	# At root (/)
	docker build -t dcraudit-dev .

	# At /sql/
	docker build -t dcraudit-db-dev .


# Development Run

# Instructions: Using Docker Compose
	# Make sure that the data persistence container is running
	docker run -i --name dcraudit-db-data dcraudit-db-dev /bin/echo "PostgreSQL data container"

	# Run docker compose to set up the database container and web-accessible container
	docker-compose up -d
	docker-compose down
