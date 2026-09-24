# req-140 parity queue — promote/add candidates left after batch 1

Unique targets; several gap names can map to one. Ours only (DEC-068 §3): free-db ids to promote and our own `own-*` ids to add. No RepDB names or text. Built
2026-09-24 from the out-of-git gap table (`.vendor-cache/`, RepDB `9ed9357`). Later batches take ≤40 each (DEC-066 §2),
ranked by how widely they are done in gyms, beginner-first (DEC-067).

## Promote (79) — free-db ids

Band_Good_Morning · Band_Hip_Adductions · Barbell_Ab_Rollout · Barbell_Rear_Delt_Row · Barbell_Shrug_Behind_The_Back · Bent-Arm_Barbell_Pullover · Body_Tricep_Press · Cable_Wrist_Curl · Cat_Stretch · Childs_Pose · Close-Grip_Dumbbell_Press · Cross_Body_Hammer_Curl · Decline_Dumbbell_Flyes · Donkey_Calf_Raises · Drag_Curl · Dumbbell_Squat · Exercise_Ball_Pull-In · External_Rotation_with_Cable · Flat_Bench_Leg_Pull-In · Front_Cable_Raise · Hug_Knees_To_Chest · Isometric_Neck_Exercise_-_Sides · Kettlebell_Halo · Kettlebell_Sumo_High_Pull · Kettlebell_Windmill · Kneeling_Forearm_Stretch · Kneeling_High_Pulley_Row · Kneeling_Hip_Flexor · Leverage_Shrug · Lying_One-Arm_Lateral_Raise · Monster_Walk · One-Arm_Kettlebell_Military_Press_To_The_Side · One_Arm_Lat_Pulldown · Physioball_Hip_Bridge · Plate_Pinch · Plyo_Push-up · Power_Jerk · Preacher_Hammer_Dumbbell_Curl · Push-Ups_With_Feet_On_An_Exercise_Ball · Quad_Stretch · Reverse_Grip_Bent-Over_Rows · Ring_Dips · Rope_Climb · Scapular_Pull-Up · Scissor_Kick · Seated_Triceps_Press · Side_Leg_Raises · Side_Neck_Stretch · Single-Leg_Leg_Extension · Smith_Machine_Bent_Over_Row · Smith_Machine_Decline_Press · Smith_Machine_Hip_Raise · Smith_Machine_Stiff-Legged_Deadlift · Smith_Machine_Upright_Row · Smith_Single-Leg_Split_Squat · Split_Jerk · Standing_Barbell_Calf_Raise · Standing_Barbell_Press_Behind_Neck · Standing_Front_Barbell_Raise_Over_Head · Standing_Gastrocnemius_Calf_Stretch · Standing_One-Arm_Dumbbell_Triceps_Extension · Standing_Overhead_Barbell_Triceps_Extension · Suspended_Push-Up · Suspended_Split_Squat · Svend_Press · The_Straddle · Triceps_Stretch · Two-Arm_Kettlebell_Military_Press · Upright_Cable_Row · V-Bar_Pullup · Wide-Grip_Pulldown_Behind_The_Neck · Wrist_Roller

## Add (29) — our ids

own-archer-pull-up · own-archer-push-up · own-back-lever · own-bear-crawl · own-butterfly-stretch · own-clamshell · own-couch-stretch · own-cross-body-shoulder-stretch · own-doorway-chest-stretch · own-dragon-flag · own-dumbbell-deadlift · own-dumbbell-front-squat · own-fire-hydrant · own-front-lever · own-jefferson-curl · own-l-sit · own-machine-back-extension · own-overhead-carry · own-pigeon-stretch · own-reverse-nordic · own-reverse-plank · own-spoto-press · own-stability-ball-pike · own-standing-hip-abduction · own-suspension-curl · own-suspension-leg-curl · own-terminal-knee-extension · own-wall-push-up · own-windshield-wipers

## Promote — added by req-143 triage (`finish`, after coach QA round 2)

Alternate_Heel_Touchers · Alternating_Renegade_Row · Ankle_On_The_Knee · Barbell_Step_Ups · Bicycling · Cable_Hip_Adduction · Cable_Preacher_Curl · Clean_and_Press · Decline_Dumbbell_Bench_Press · Dumbbell_Clean · Exercise_Ball_Crunch · External_Rotation_with_Band · Front_Leg_Raises · Front_Plate_Raise · Hamstring_Stretch · Hang_Snatch · High_Cable_Curls · Inchworm · JM_Press · Knee_Across_The_Body · Knee_Tuck_Jump · Landmine_180s · Lateral_Bound · Leverage_High_Row · Lying_T-Bar_Row · Oblique_Crunches · One-Arm_Kettlebell_Snatch · One_Arm_Dumbbell_Preacher_Curl · Power_Snatch · Reverse_Hyperextension · Round_The_World_Shoulder_Stretch · Sled_Drag_-_Harness · Split_Jump · Standing_Long_Jump · Step-up_with_Knee_Raise · Tire_Flip · Weighted_Sissy_Squat · Worlds_Greatest_Stretch · Zercher_Squats · extra-prone-ytw · extra-reverse-snow-angels · Clean_Pull · External_Rotation · Lateral_Raise_-_With_Bands · One-Arm_Kettlebell_Clean · One-Arm_Kettlebell_Row · Plate_Twist · Seated_Dumbbell_Palms-Down_Wrist_Curl · Seated_Dumbbell_Palms-Up_Wrist_Curl · Shoulder_Press_-_With_Bands · Snatch_Pull · Suspended_Reverse_Crunch

## Add — added by req-143 (queued own-*)

own-kettlebell-deadlift · own-lateral-band-walk

## Batch notes

- Alternating_Renegade_Row: equipment is dumbbells. Weighted_Sissy_Squat: ship as "Sissy Squat", bodyweight-reps. Plate_Twist: "Weighted Russian Twist", weight-reps. A batch that writes a PENDING_ADDS id removes it from `triage.js`.
