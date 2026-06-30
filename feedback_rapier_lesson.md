---
name: feedback-rapier-lesson
description: "Critical Rapier2D behavior: QueryPipeline must be stepped before computeColliderMovement works"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c6445066-096b-4e1f-ad74-ec923fa6f1eb
---

`KinematicCharacterController.computeColliderMovement` uses Rapier's `QueryPipeline` for broad-phase candidate detection. The QueryPipeline is only populated/updated when `world.step()` is called. Without it, no static bodies are found and no collision is detected (returns full desired movement silently).

**Why:** Discovered by debugging Slice 1. Using `body.setTranslation()` to sync kinematic body position does NOT update the QueryPipeline. Only `world.step()` does.

**How to apply:** Always call `world.step()` in the `CollisionWorld` constructor after adding static bodies. Also call it inside `resolveMovement` (using `setNextKinematicTranslation` + `world.step()`) before each `computeColliderMovement` call — this is the only way to guarantee the pipeline reflects current body positions on both server AND client (client never has an external step() caller in the prediction path).
