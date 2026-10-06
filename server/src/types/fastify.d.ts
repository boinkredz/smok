import "fastify";

import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { PrismaClient } from "../generated/prisma";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<unknown>;

    prisma: PrismaClient;
  }
}