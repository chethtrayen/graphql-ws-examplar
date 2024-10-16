import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { createServer } from "http";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import express from "express";
import cors from "cors";
import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";

// Graphql stuff ---------------------------------------
const typeDefs = `#graphql
    type Query {
        currentNum: Int
    }

    type Mutation{
        incrementNumber(num: Int!): Int
    }


    type Subscription {
        numberIncremented: Int
    }
`;

// Graphql stuff ---------------------------------------

const options = {
  host: "127.0.0.1",
  port: 6379,
  password: "eYVX7EwVmmxKPCDmwMtyKVge8oLd2t81",
  messageEventName: "buffer",
  pmessageEventName: "pBuffer",
};
const app = express();
const httpServer = createServer(app);
const pubsub = new RedisPubSub({
  publisher: new Redis(options),
  subscriber: new Redis(options),
});

let currentNum = 0;

const resolvers = {
  Query: {
    currentNum() {
      return currentNum;
    },
  },

  Mutation: {
    incrementNumber(_, args) {
      pubsub.publish("Test", { numberIncremented: args.num });
      return args.num;
    },
  },

  Subscription: {
    numberIncremented: {
      subscribe: () => pubsub.asyncIterator(["NUMBER_INCREMENTED"]),
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const ws = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

const serverCleanup = useServer({ schema }, ws);

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

pubsub.subscribe("Test", (message) => {
  console.log(message.test);
  pubsub.publish("NUMBER_INCREMENTED", { numberIncremented: message });
});

await server.start();

app.use(
  "/graphql",
  cors<cors.CorsRequest>(),
  express.json(),
  expressMiddleware(server)
);

const PORT = 4000;

httpServer.listen(PORT, () => {
  console.log("started service");
});
