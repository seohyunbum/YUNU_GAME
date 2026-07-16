using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using WorldConquest.Core.Data;

namespace WorldConquest.ConsoleHost;

/// <summary>
/// 밸런스 편집 패널 (설계문서 §5.6 [SHOULD]) — localhost 전용 웹 UI.
/// 편집 폼은 데이터 JSON 에서 자동 생성(수기 필드 목록 없음 — 드리프트 원천 차단)하고,
/// 저장은 반드시 §5.5 와 동일한 DataLoader 검증을 통과한 뒤에만 atomic write 한다 [MUST].
/// 극단 실험값은 클램프하지 않는다 — 타입·참조 무결성·구조 규칙만 검증 (놀이의 자유는 값에, 정합성은 검증기에).
/// </summary>
public static class PanelServer
{
    /// <summary>편집 허용 파일 (data/ 상대 경로) — 밸런스·콘텐츠 수치의 SSOT 들.</summary>
    private static readonly string[] EditableFiles =
    {
        DataLoader.RulesFile, DataLoader.CharactersFile,
        DataLoader.LandUnitsFile, DataLoader.NavalUnitsFile,
        DataLoader.RateTablesFile, DataLoader.TerrainFile, DataLoader.FactionsFile
    };

    public static void Run(string dataDir, int port = 8377)
    {
        var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        listener.Start();
        Console.WriteLine($"밸런스 패널: http://localhost:{port}  (Ctrl+C 로 종료)");
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            { FileName = $"http://localhost:{port}", UseShellExecute = true });
        }
        catch { /* 브라우저 자동 오픈 실패는 무해 — URL 을 직접 열면 됨 */ }

        while (true)
        {
            var ctx = listener.GetContext();
            try { Handle(ctx, dataDir); }
            catch (Exception ex) { WriteJson(ctx, 500, new { ok = false, errors = new[] { ex.Message } }); }
        }
        // ReSharper disable once FunctionNeverReturns — 패널은 Ctrl+C 종료
    }

    private static void Handle(HttpListenerContext ctx, string dataDir)
    {
        var path = ctx.Request.Url!.AbsolutePath;
        switch (ctx.Request.HttpMethod, path)
        {
            case ("GET", "/"):
                WriteText(ctx, 200, "text/html; charset=utf-8", Html);
                break;

            case ("GET", "/files"):
                var files = EditableFiles.ToDictionary(
                    f => f,
                    f => JsonNode.Parse(File.ReadAllText(Path.Combine(dataDir, f))));
                WriteText(ctx, 200, "application/json; charset=utf-8",
                    JsonSerializer.Serialize(files, new JsonSerializerOptions { WriteIndented = false }));
                break;

            case ("POST", "/save"):
            {
                using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
                var body = JsonNode.Parse(reader.ReadToEnd())!;
                var relFile = body["path"]!.GetValue<string>();
                var content = body["content"]!.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
                if (!EditableFiles.Contains(relFile))
                { WriteJson(ctx, 400, new { ok = false, errors = new[] { $"편집 불가 파일: {relFile}" } }); break; }

                // §5.5 단일 검증 경로: 전체 data 를 임시 폴더에 복사 → 수정 반영 → DataLoader 로드
                var temp = Path.Combine(Path.GetTempPath(), "wc_panel", Guid.NewGuid().ToString("N"));
                try
                {
                    CopyDir(dataDir, temp);
                    File.WriteAllText(Path.Combine(temp, relFile), content);
                    try
                    {
                        _ = new DataLoader().Load(temp);   // 검증 실패 시 DataValidationException
                    }
                    catch (DataValidationException ex)
                    {
                        WriteJson(ctx, 422, new
                        {
                            ok = false,
                            errors = ex.Errors.Select(e => $"[{e.File}] ({e.Entry}) {e.Message}").ToArray()
                        });
                        break;
                    }
                    // 검증 통과 → atomic write (§5.6·D7)
                    var target = Path.Combine(dataDir, relFile);
                    var tmp = target + ".tmp";
                    File.WriteAllText(tmp, content);
                    if (File.Exists(target)) File.Replace(tmp, target, null);
                    else File.Move(tmp, target);
                    WriteJson(ctx, 200, new { ok = true });
                }
                finally
                {
                    try { Directory.Delete(temp, recursive: true); } catch { /* 정리 실패 무시 */ }
                }
                break;
            }

            default:
                WriteText(ctx, 404, "text/plain", "not found");
                break;
        }
    }

    private static void CopyDir(string src, string dst)
    {
        Directory.CreateDirectory(dst);
        foreach (var f in Directory.GetFiles(src))
            File.Copy(f, Path.Combine(dst, Path.GetFileName(f)));
        foreach (var d in Directory.GetDirectories(src))
            CopyDir(d, Path.Combine(dst, Path.GetFileName(d)));
    }

    private static void WriteJson(HttpListenerContext ctx, int status, object payload) =>
        WriteText(ctx, status, "application/json; charset=utf-8", JsonSerializer.Serialize(payload));

    private static void WriteText(HttpListenerContext ctx, int status, string contentType, string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text);
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = contentType;
        ctx.Response.ContentLength64 = bytes.Length;
        ctx.Response.OutputStream.Write(bytes);
        ctx.Response.Close();
    }

    /// <summary>편집 UI — 필드 폼은 JSON 데이터에서 재귀 생성 (수기 목록 없음).</summary>
    private const string Html = """
<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<title>WorldConquest 밸런스 패널</title>
<style>
 body{font-family:'Malgun Gothic',sans-serif;margin:0;background:#1b1b22;color:#e8e6e0}
 header{padding:14px 22px;background:#26262f;border-bottom:2px solid #c9a227;display:flex;gap:16px;align-items:center}
 h1{font-size:17px;margin:0;color:#c9a227} nav{display:flex;gap:6px;flex-wrap:wrap}
 nav button{background:#33333e;color:#ccc;border:1px solid #444;padding:6px 12px;cursor:pointer;border-radius:4px}
 nav button.on{background:#c9a227;color:#1b1b22;font-weight:bold}
 main{padding:18px 22px;max-width:1000px}
 .grp{margin:10px 0;border:1px solid #3a3a46;border-radius:6px;overflow:hidden}
 .grp>summary{padding:8px 12px;background:#26262f;cursor:pointer;font-weight:bold;color:#e0c96a}
 .row{display:flex;align-items:center;gap:10px;padding:4px 16px;border-top:1px solid #2c2c35}
 .row label{flex:1;color:#aaa;font-size:13px;word-break:break-all}
 .row input{width:130px;background:#111;color:#7fda89;border:1px solid #444;padding:4px 8px;border-radius:3px;text-align:right}
 .row input.str{width:280px;text-align:left;color:#8ecbff}
 #bar{position:sticky;bottom:0;background:#26262f;padding:12px 22px;border-top:2px solid #c9a227;display:flex;gap:12px;align-items:center}
 #save{background:#c9a227;color:#1b1b22;border:0;padding:10px 26px;font-weight:bold;font-size:15px;cursor:pointer;border-radius:5px}
 #msg{white-space:pre-wrap;font-size:12px} .ok{color:#7fda89} .err{color:#ff8080}
</style></head><body>
<header><h1>⚖ WorldConquest 밸런스 패널</h1><nav id="tabs"></nav></header>
<main id="form"></main>
<div id="bar"><button id="save">저장 (검증 후 반영)</button><div id="msg">파일을 선택해 수치를 조정하세요. 저장은 게임과 동일한 검증(§5.5)을 통과해야 반영됩니다.</div></div>
<script>
let DATA={}, cur=null;
const tabs=document.getElementById('tabs'), form=document.getElementById('form'), msg=document.getElementById('msg');
fetch('/files').then(r=>r.json()).then(d=>{DATA=d;
  Object.keys(d).forEach(f=>{const b=document.createElement('button');b.textContent=f.split('/').pop();
    b.onclick=()=>{cur=f;[...tabs.children].forEach(x=>x.classList.remove('on'));b.classList.add('on');render();};tabs.appendChild(b);});
  tabs.children[0].click();});
function render(){form.innerHTML='';build(DATA[cur],[],form);}
function build(node,path,parent){
  if(Array.isArray(node)){node.forEach((v,i)=>{
    const name=(v&&typeof v==='object'&&(v.id||v.name_ko))?(v.id||v.name_ko):('#'+i);
    group(name,path.concat(i),v,parent);});return;}
  if(node&&typeof node==='object'){
    const prims=Object.entries(node).filter(([k,v])=>typeof v!=='object'||v===null);
    const objs=Object.entries(node).filter(([k,v])=>typeof v==='object'&&v!==null);
    prims.forEach(([k,v])=>row(k,path.concat(k),v,parent));
    objs.forEach(([k,v])=>group(k,path.concat(k),v,parent));}}
function group(title,path,node,parent){
  const d=document.createElement('details');d.className='grp';if(path.length<=1)d.open=true;
  const s=document.createElement('summary');s.textContent=title;d.appendChild(s);
  build(node,path,d);parent.appendChild(d);}
function row(key,path,val,parent){
  const r=document.createElement('div');r.className='row';
  const l=document.createElement('label');l.textContent=key;r.appendChild(l);
  const i=document.createElement('input');
  if(typeof val==='number'){i.type='number';i.value=val;i.onchange=()=>setPath(path,i.value===''?0:Number(i.value));}
  else if(typeof val==='boolean'){i.type='checkbox';i.checked=val;i.onchange=()=>setPath(path,i.checked);}
  else{i.className='str';i.value=val===null?'':String(val);i.onchange=()=>setPath(path,i.value);}
  r.appendChild(i);parent.appendChild(r);}
function setPath(path,val){let o=DATA[cur];for(let j=0;j<path.length-1;j++)o=o[path[j]];o[path[path.length-1]]=val;}
document.getElementById('save').onclick=()=>{
  msg.textContent='검증 중…';msg.className='';
  fetch('/save',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:cur,content:DATA[cur]})})
  .then(r=>r.json()).then(res=>{
    if(res.ok){msg.textContent='✔ 저장 완료 — 게임 재시작(또는 새 캠페인) 시 반영됩니다.';msg.className='ok';}
    else{msg.textContent='✘ 검증 실패 — 저장되지 않았습니다:\n'+res.errors.join('\n');msg.className='err';}});};
</script></body></html>
""";
}
