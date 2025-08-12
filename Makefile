COMPOSE_FILE = docker-compose.yml

all: build up

build:
	@echo "Building containers..."
	@docker-compose -f $(COMPOSE_FILE) build

up:
	@echo "Starting containers..."
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "Frontend available at: http://localhost:5173"
	@echo "Backend available at: http://localhost:3000"
	@echo "Prometheus available at: http://localhost:9090"
	@echo "Grafana available at: http://localhost:3001"

down:
	@echo "Stopping containers..."
	@docker-compose -f $(COMPOSE_FILE) down

clean: down
	@echo "Cleaning containers and images..."
	@docker system prune -af

fclean: clean
	@echo "Removing volumes..."
	@docker volume prune -f

re: fclean all

logs:
	@docker-compose -f $(COMPOSE_FILE) logs -f

status:
	@docker-compose -f $(COMPOSE_FILE) ps

.PHONY: all build up down clean fclean re logs status