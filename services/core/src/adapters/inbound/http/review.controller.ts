// Driving adapter: human review actions. Parse/validate, delegate to the review
// service, return the outcome. approve / override / dismiss (PRD §3.3, F8).
import type { FastifyInstance } from "fastify";
import type { ReviewService, ReviewAction } from "../../../application/review/review.service.js";
import { data, failure } from "./envelope.js";

const ACTIONS: ReviewAction[] = ["approve", "override", "dismiss"];

export function registerReviewRoutes(app: FastifyInstance, review: ReviewService) {
  app.post<{ Params: { id: string }; Body: { action?: string; actor?: string; note?: string; matchWith?: string } }>(
    "/review-items/:id/action",
    async (req, reply) => {
      const body = req.body ?? {};
      if (!body.action || !ACTIONS.includes(body.action as ReviewAction)) {
        return reply
          .code(400)
          .send(failure(`action must be one of ${ACTIONS.join(", ")}`));
      }
      const res = await review.act(req.params.id, {
        action: body.action as ReviewAction,
        actor: body.actor ?? "user:demo",
        note: body.note,
        matchWith: body.matchWith,
      });
      if (!res.ok) return reply.code(400).send(failure(res.error.message));
      return reply.send(data({ status: "ok", ...res.value }));
    },
  );
}
