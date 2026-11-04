# One More Run

**[Play the game](https://one-more-run-avyya.vercel.app)** · **[Source code](https://github.com/avyya-singh/one-more-run)**

A small pixel arena with an adaptive rival, a real browser-local movement classifier, and an inspectable replay lab. All pixel artwork is drawn in Canvas/CSS; there are no generated illustrations or third-party character assets.

## Play

- **WASD / arrow keys:** move.
- **Mouse:** aim; hold click to attack.
- **J:** attack with auto-aim at Mochi.
- **Space:** dash while moving; dashes briefly grant invulnerability.
- **P:** pause/resume. Switching tabs pauses the round automatically.
- On touch devices, use the directional buttons plus Dash and Attack.

Rounds end when either character loses all health or 45 seconds elapse. Rocks block movement and projectiles. Your model and up to eight recent rounds stay in this browser; nothing is uploaded. Sound is off unless you enable it.

After a round, use **Watch in arena** or the replay controls to replay recorded positions. Scrub to a time, change playback speed, or select a timestamped event. **New round** returns to gameplay. Replays never update model weights.

## The ML is actual training

`src/model.ts` implements multinomial logistic regression: a five-class softmax classifier with 23 input features and 115 trainable weights. Parameters update using online stochastic gradient descent, a decaying learning rate, and L2 regularization. No language model or paid API is involved.

Every 250 ms, the game scores a prediction from the preceding observation against the next movement command: left, right, up, down, or idle. Only **after scoring** does it train on that sample. This is prequential evaluation, avoiding training on a sample before measuring its prediction.

Features include relative positions, distance, health, cooldowns, current and previous movement, nearby obstacle probes, time, a bias term, and the previous action. Diagonal input is labeled by its dominant axis; this is a simplified action representation.

### How Mochi adapts

- **Adaptive:** if the model's next-action confidence exceeds 30%, Mochi leads its shots in the predicted direction. Confidence is an uncalibrated softmax probability, not a guarantee of correctness.
- **Scripted:** Mochi aims at delayed observed positions without model-guided aim.

Both modes collect telemetry and train the model. The rival's movement/shot cadence is otherwise governed by the same game rules. Adaptive mode is not guaranteed to be harder, and the model is not a reinforcement-learning agent. It learns to predict the player; it does not learn a combat policy.

### Honest metrics

The dashboard shows next-action accuracy alongside an online majority-action baseline. The baseline predicts the most common action observed so far in the current round (idle initially), also before observing the next label. Standing still can produce high model accuracy while the baseline does even better. Cross-entropy reports probability quality on the sampled predictions.

Comparisons between manually played rounds are observational. Different player behavior, model history, and seeds mean they are not a controlled causal benchmark.

## Telemetry, replay, and offline evaluation

Gameplay uses a fixed 60 Hz timestep and seeded randomness. Replay snapshots are captured at 10 Hz; playback uses those snapshots instead of re-running or re-training the model. Display timing has 100 ms snapshot granularity, so event seeks can show the preceding captured frame.

**Export telemetry** downloads JSON containing recent rounds, exact training feature vectors, labels, predictions, losses, hits, attacks, dashes, recorded positions/projectiles, and model checkpoints before and after each round. It contains no account credentials or server-side data.

To run an independent offline evaluation on your export:

```sh
npm run evaluate -- /path/to/one-more-run-telemetry.json
```

The script trains a fresh model on the first 70% of samples and evaluates on the final 30%, without fitting on the held-out samples. It reports accuracy, a train-majority baseline, mean cross-entropy, and a five-class confusion matrix. At least 30 valid samples are required. Gameplay observations are autocorrelated and class-imbalanced; this tiny personal dataset does not establish generalization to other players.

## Run and test

Requires Node 22+.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4183. To build and test:

```sh
npm test
npm run build
```

Tests exercise probability normalization, actual learning, pre-update scoring, model persistence, feature dimensions, obstacle collision, deterministic combat telemetry, time limits, adaptive-vs-scripted behavior, and chronological held-out evaluation. Tests are synthetic engineering checks, not claims of player-model accuracy.

## Stack

- TypeScript, Canvas 2D, CSS, Vite.
- Handwritten softmax classifier and offline evaluation; no ML framework needed for this small model.
- Browser-local persistence and downloadable JSON.
- GitHub Actions for tests and production build.
- Static Vercel Hobby deployment; no backend, keys, paid inference, or shared-user state.

Optional container build:

```sh
docker build -t one-more-run .
docker run --rm -p 127.0.0.1:4183:80 one-more-run
```

## Files

`src/engine.ts` owns simulation/combat/telemetry, `src/model.ts` owns learning, `src/render.ts` draws original pixel art, and `src/main.ts` connects UI, inputs, persistence, and replay. `scripts/evaluate-telemetry.ts` provides the offline experiment. All source is kept separate from the earlier PatchNotes and portfolio projects.

Original project by Avyya Singh. Google Fonts are used for UI typography; gameplay, telemetry, and learning never leave your browser.
