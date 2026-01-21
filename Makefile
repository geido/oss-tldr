DEV_COMPOSE = docker compose
PROD_COMPOSE = docker compose -f docker-compose.prod.yml

.PHONY: dev-start dev-resume dev-clean prod-start prod-resume prod-clean

dev-start:
	$(DEV_COMPOSE) up --build -d

dev-resume:
	$(DEV_COMPOSE) up -d

dev-clean:
	$(DEV_COMPOSE) down --volumes --remove-orphans

prod-start:
	$(PROD_COMPOSE) up --build -d

prod-resume:
	$(PROD_COMPOSE) up -d

prod-clean:
	$(PROD_COMPOSE) down --volumes --remove-orphans
