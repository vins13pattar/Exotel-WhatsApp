dev:
	npm install
	npm -w apps/api run prisma:generate
	docker compose -f docker-compose.dev.yml up --build

build:
	npm install
	npm run build
	docker compose -f docker-compose.prod.yml build

lint:
	npm run lint

test:
	npm run test
