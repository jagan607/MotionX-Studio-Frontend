import sys
import os
sys.path.append("/Users/jagan/MotionX-Studio-Backend")

from app.services.context_builder import generate_context_layer

try:
    res = generate_context_layer(
        scene_action="Bob walks in.",
        characters="Bob",
        location="Office",
        genre="Drama"
    )
    print("SUCCESS", res)
except Exception as e:
    print("FAILED", type(e), e)
