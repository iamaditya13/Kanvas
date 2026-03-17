const { z } = require('../lib/validation');

const uuid = z.string().uuid();
const finiteNumber = z.number().finite();
const boundedNumber = finiteNumber.min(-100000).max(100000);
const sizeNumber = z.number().finite().min(0).max(100000);
const color = z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/);
const pointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
});

const elementTypeSchema = z.enum(['sticky', 'text', 'path']);

const elementPayloadSchema = z
  .object({
    points: z.array(pointSchema).max(5000).optional(),
    strokeWidth: z.number().min(1).max(24).optional(),
    fontSize: z.number().min(12).max(96).optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
  })
  .passthrough()
  .default({});

const workspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const boardSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const boardUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const shareSettingsSchema = z.object({
  visibility: z.enum(['private', 'link']),
  shareRole: z.enum(['viewer', 'editor']),
  regenerate: z.boolean().optional().default(false),
});

const createElementSchema = z
  .object({
    type: elementTypeSchema,
    x: boundedNumber,
    y: boundedNumber,
    width: sizeNumber,
    height: sizeNumber,
    content: z.string().max(20000).default(''),
    color: color.default('#FFF9C4'),
    payload: elementPayloadSchema,
  })
  .superRefine((value, ctx) => {
    if (value.type === 'path') {
      if (!value.payload.points || value.payload.points.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['payload', 'points'],
          message: 'Path elements require at least two points',
        });
      }
      if (!value.payload.strokeWidth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['payload', 'strokeWidth'],
          message: 'Path elements require a strokeWidth',
        });
      }
    }

    if (value.type === 'text' && !value.content.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content'],
        message: 'Text elements require content',
      });
    }
  });

const moveElementSchema = z.object({
  x: boundedNumber,
  y: boundedNumber,
});

const updateElementSchema = z
  .object({
    x: boundedNumber.optional(),
    y: boundedNumber.optional(),
    width: sizeNumber.optional(),
    height: sizeNumber.optional(),
    content: z.string().max(20000).optional(),
    color: color.optional(),
    payload: elementPayloadSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

const createCommentSchema = z.object({
  elementId: uuid,
  content: z.string().trim().min(1).max(5000),
});

const boardJoinSchema = z.object({
  boardId: uuid,
  shareToken: z.string().trim().min(6).max(120).optional(),
});

const cursorMoveSchema = z.object({
  boardId: uuid,
  x: finiteNumber,
  y: finiteNumber,
});

const createElementEventSchema = z.object({
  boardId: uuid,
  clientMutationId: z.string().trim().min(1).max(120),
  element: createElementSchema,
});

const updateElementEventSchema = z.object({
  boardId: uuid,
  clientMutationId: z.string().trim().min(1).max(120),
  elementId: uuid,
  patch: updateElementSchema,
});

const moveElementEventSchema = z.object({
  boardId: uuid,
  clientMutationId: z.string().trim().min(1).max(120),
  elementId: uuid,
  position: moveElementSchema,
});

const deleteElementEventSchema = z.object({
  boardId: uuid,
  clientMutationId: z.string().trim().min(1).max(120),
  elementId: uuid,
});

const commentEventSchema = z.object({
  boardId: uuid,
  clientMutationId: z.string().trim().min(1).max(120),
  comment: createCommentSchema,
});

const heartbeatSchema = z.object({
  boardId: uuid,
});

module.exports = {
  workspaceSchema,
  boardSchema,
  boardUpdateSchema,
  shareSettingsSchema,
  createElementSchema,
  moveElementSchema,
  updateElementSchema,
  createCommentSchema,
  boardJoinSchema,
  cursorMoveSchema,
  createElementEventSchema,
  updateElementEventSchema,
  moveElementEventSchema,
  deleteElementEventSchema,
  commentEventSchema,
  heartbeatSchema,
};
