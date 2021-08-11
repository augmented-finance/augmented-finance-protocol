FROM node:16
COPY package.json yarn.lock /src/
WORKDIR /src
RUN yarn install
COPY . /src/
RUN yarn compile
CMD ["npx", "hardhat", "node"]
