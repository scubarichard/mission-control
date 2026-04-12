import json
with open('/tmp/exec_28759.json') as f:
    d = json.load(f)
rd = d['data']['resultData']['runData']
for name in rd:
    entries = rd[name]
    if entries and entries[0].get('data', {}).get('main', [[]])[0]:
        out = entries[0]['data']['main'][0][0]['json']
        ok = out.get('ok', 'N/A')
        err = out.get('error', '')
        print(f"{name}: ok={ok} error={err}")
    else:
        st = entries[0].get('executionStatus', '?') if entries else '?'
        print(f"{name}: {st} (no output)")
