import subprocess
import time
import sys
import os
from pathlib import Path
import httpx

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from tests.create_synthetic_nifti import generate_synthetic_multimodal_set
import tempfile

def run_live_test():
    print("=" * 70)
    print("STARTING LIVE UVICORN SERVER E2E TEST")
    print("=" * 70)
    
    python_exe = sys.executable
    cmd = [python_exe, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8008"]
    
    print(f"Starting uvicorn on port 8008...")
    proc = subprocess.Popen(cmd, cwd=str(backend_dir))
    
    try:
        # Wait for server to become responsive
        client = httpx.Client(base_url="http://127.0.0.1:8008", timeout=60.0)
        ready = False
        for i in range(15):
            try:
                r = client.get("/api/v1/health")
                if r.status_code == 200 and r.json().get("model_loaded"):
                    ready = True
                    print(f"Server ready after {i+1}s: {r.json()['status']}")
                    break
            except Exception:
                pass
            time.sleep(1)
            
        if not ready:
            raise RuntimeError("Server did not become ready in 15 seconds")
            
        # 1. Health check
        print("\n[Stage 1] Verifying /api/v1/health...")
        h = client.get("/api/v1/health").json()
        assert h["model_loaded"] is True
        print(f"  PASS: Model loaded = True, device = {h['device']}")
        
        # 2. Missing modality test
        print("\n[Stage 2] Verifying validation on missing modality...")
        r_missing = client.post(
            "/api/v1/analyze",
            data={"patient_id": "P_FAIL", "age": "50", "sex": "Male"},
        )
        assert r_missing.status_code in (400, 422)
        print(f"  PASS: Validation rejected missing modality with code {r_missing.status_code}")
        
        # 3. Analyze with synthetic multimodal NIfTIs
        print("\n[Stage 3] Uploading 4 multimodal MRI NIfTIs to /api/v1/analyze...")
        with tempfile.TemporaryDirectory() as td:
            paths = generate_synthetic_multimodal_set(Path(td))
            
            files = []
            opened = []
            for mod in ["t1", "t1ce", "t2", "flair"]:
                key = "T1ce" if mod == "t1ce" else ("FLAIR" if mod == "flair" else mod.upper())
                p = paths[key]
                f = open(p, "rb")
                opened.append(f)
                files.append((mod, (p.name, f, "application/octet-stream")))
                
            data = {"patient_id": "PT_LIVE_001", "age": "62", "sex": "Female"}
            
            t0 = time.time()
            res = client.post("/api/v1/analyze", data=data, files=files)
            duration = time.time() - t0
            
            for f in opened:
                f.close()
                
            assert res.status_code == 200, f"Error {res.status_code}: {res.text}"
            res_data = res.json()
            print(f"  PASS: Prediction returned in {duration:.2f}s: status={res_data['status']}")
            print(f"  Analysis ID: {res_data['analysis_id']}")
            print(f"  Prediction: {res_data['prediction']['label']} (Class {res_data['prediction']['class']})")
            print(f"  Probabilities: {res_data['probabilities']}")
            analysis_id = res_data["analysis_id"]
            
        # 4. Explainability endpoint
        print("\n[Stage 4] Fetching explainability for analysis_id...")
        xai_res = client.get(f"/api/v1/analysis/{analysis_id}/explainability")
        assert xai_res.status_code == 200
        xai = xai_res.json()
        
        assert "shap" in xai
        assert len(xai["shap"]["mri_modalities"]) == 4
        assert len(xai["shap"]["clinical_features"]) == 2
        print("  PASS: Modality SHAP values:")
        for m in xai["shap"]["mri_modalities"]:
            print(f"    - {m['modality']}: {m['shap_value']:+.4f} ({m['percentage']:.1f}%)")
        print("  PASS: Clinical SHAP values:")
        for c in xai["shap"]["clinical_features"]:
            print(f"    - {c['feature']}: {c['shap_value']:+.4f} ({c['percentage']:.1f}%)")
            
        assert "gradcam" in xai
        gradcam = xai["gradcam"]
        print(f"  PASS: Grad-CAM++ target layer = {gradcam['target_layer']}, peak slice = #{gradcam['recommended_slice']+1}")
        assert gradcam["initial_slice"]["overlay_slice_base64"].startswith("data:image/png;base64,")
        
        # 5. Dynamic slice endpoint
        print("\n[Stage 5] Fetching dynamic slice from /api/v1/analysis/{id}/gradcam/slice...")
        slice_res = client.get(f"/api/v1/analysis/{analysis_id}/gradcam/slice", params={"modality": "FLAIR", "slice_idx": 48, "opacity": 0.65})
        assert slice_res.status_code == 200
        sl = slice_res.json()
        assert sl["slice_index"] == 48
        assert sl["modality"] == "FLAIR"
        assert sl["overlay_slice_base64"].startswith("data:image/png;base64,")
        print(f"  PASS: Dynamic slice fetched successfully: slice 48, modality FLAIR, overlay len={len(sl['overlay_slice_base64'])}")
        
        # 6. Patient isolation check
        print("\n[Stage 6] Checking patient session isolation...")
        bad_res = client.get("/api/v1/analysis/invalid-session-uuid/explainability")
        assert bad_res.status_code == 404
        print(f"  PASS: Invalid session correctly returns 404 Not Found")
        
        print("\n" + "=" * 70)
        print("ALL LIVE HTTP E2E TESTS PASSED PERFECTLY!")
        print("=" * 70)
        
    finally:
        print("Stopping uvicorn server...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        print("Server stopped.")

if __name__ == "__main__":
    run_live_test()
