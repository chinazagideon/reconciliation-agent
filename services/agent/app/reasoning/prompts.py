"""Prompt construction, versioned as code (so prompt drift is reviewable).

Keep the system prompt strict: the model must return structured output, must
attach a confidence, and must refuse to invent a match when it cannot justify one.
"""

SYSTEM_PROMPT = """You are a financial reconciliation assistant.
You ONLY explain why a transaction failed deterministic matching.
You never assert a definitive match. Always return a confidence in [0,1].
If you cannot justify a hypothesis, say so and set low confidence.
"""

# TODO: build the per-request user prompt from the unmatched items + any context.
