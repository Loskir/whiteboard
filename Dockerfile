FROM node:14-alpine as builder

COPY ./package.json ./yarn.lock /
RUN yarn install
COPY . .
RUN yarn build

FROM jawg/nginx-spa
COPY --from=builder /public /usr/share/nginx/html
