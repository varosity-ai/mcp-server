# Varosity

The `varosity` MCP server generates video, images, voice and music.

- Call `list_models` (optionally with `kind`) to see models and prices before generating.
- `generate_video` returns a `jobId`. Poll `get_job` until `status` is `succeeded`, then read `outputUrl`. Renders take about 30 seconds to 3 minutes.
- Generation spends the user's prepaid Varosity credits or their own provider keys. Tell the user the price before an expensive render.
