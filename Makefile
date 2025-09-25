COMPOSE_FILE = docker-compose.yml

LOCAL_IP := $(shell ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || hostname -I 2>/dev/null | awk '{print $$1}' || ifconfig 2>/dev/null | grep -E "inet.*broadcast" | awk '{print $$2}' | head -1)

all: build up

build:
	@echo "Building containers..."
	@docker-compose -f $(COMPOSE_FILE) build

up:
	@echo "Starting containers..."
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "Game available at: https://$(LOCAL_IP):8443"
	@echo "Prometheus available at: https://localhost:9090"
	@echo "Grafana available at: https://localhost:3001"

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

logs-back:
	@docker-compose -f $(COMPOSE_FILE) logs -f backend

logs-front:
	@docker-compose -f $(COMPOSE_FILE) logs -f frontend

logs-db:
	@docker-compose -f $(COMPOSE_FILE) logs -f db

logs-grafana:
	@docker-compose -f $(COMPOSE_FILE) logs -f grafana

logs-prometheus:
	@docker-compose -f $(COMPOSE_FILE) logs -f prometheus

logs-nginx:
	@docker-compose -f $(COMPOSE_FILE) logs -f nginx

status:
	@docker-compose -f $(COMPOSE_FILE) ps

.PHONY: all build up down clean fclean re logs logs-back logs-front logs-db logs-grafana logs-prometheus status
