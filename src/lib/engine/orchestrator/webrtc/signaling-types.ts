// ============================================
// WebRTC Signaling Message Types
// ============================================
// Zod schemas for the signaling messages exchanged
// between the browser client and the server to
// establish WebRTC peer connections.
// ============================================

import { z } from 'zod';

// ------------------------------------------
// SDP Offer/Answer
// ------------------------------------------

export const SignalOfferSchema = z.object({
  type: z.literal('offer'),
  sessionId: z.string().min(1),
  sdp: z.string().min(1),
});

export const SignalAnswerSchema = z.object({
  type: z.literal('answer'),
  sessionId: z.string().min(1),
  sdp: z.string().min(1),
});

// ------------------------------------------
// ICE Candidate
// ------------------------------------------

export const SignalIceCandidateSchema = z.object({
  type: z.literal('ice-candidate'),
  sessionId: z.string().min(1),
  candidate: z.object({
    candidate: z.string(),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(),
    usernameFragment: z.string().nullable().optional(),
  }),
});

// ------------------------------------------
// Bye (teardown)
// ------------------------------------------

export const SignalByeSchema = z.object({
  type: z.literal('bye'),
  sessionId: z.string().min(1),
  reason: z.string().optional(),
});

// ------------------------------------------
// Discriminated Union
// ------------------------------------------

export const SignalingMessageSchema = z.discriminatedUnion('type', [
  SignalOfferSchema,
  SignalAnswerSchema,
  SignalIceCandidateSchema,
  SignalByeSchema,
]);

// ------------------------------------------
// Response types (server → client)
// ------------------------------------------

export const SignalResponseSchema = z.object({
  ok: z.boolean(),
  type: z.enum(['answer', 'ice-candidate', 'bye', 'error']),
  sessionId: z.string(),
  sdp: z.string().optional(),
  candidate: SignalIceCandidateSchema.shape.candidate.optional(),
  error: z.string().optional(),
});

// ------------------------------------------
// Type exports
// ------------------------------------------

export type SignalOffer = z.infer<typeof SignalOfferSchema>;
export type SignalAnswer = z.infer<typeof SignalAnswerSchema>;
export type SignalIceCandidate = z.infer<typeof SignalIceCandidateSchema>;
export type SignalBye = z.infer<typeof SignalByeSchema>;
export type SignalingMessage = z.infer<typeof SignalingMessageSchema>;
export type SignalResponse = z.infer<typeof SignalResponseSchema>;
