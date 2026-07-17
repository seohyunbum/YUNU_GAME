using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using WorldConquest.Core.Data;

namespace WorldConquest.ConsoleHost;

/// <summary>
/// 그래픽 클라이언트용 게임 API 서버 (ue5-client-design §2) — HTTP 는 이 파일에만 있고
/// 모든 게임 의미는 <see cref="GameSessionHost"/>(테스트됨)에 있다.
/// 기동 핸드셰이크: stdout 에 "WC_API_PORT=&lt;port&gt;" 한 줄 — UE5 가 자식 스폰 후 이 줄로 포트를 얻는다.
/// 요청은 lock 으로 직렬 처리 — 턴제 로컬 게임이라 충분하고, Core 의 단일 스레드 전제를 지킨다.
/// </summary>
public static class ApiServer
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DictionaryKeyPolicy = null,   // id 키는 원형 유지
    };

    public static void Run(GameDatabase db, string dataDir, int port, int parentPid = 0)
    {
        if (port == 0) port = FindFreePort();
        var host = new GameSessionHost(db);
        var gate = new object();

        if (parentPid > 0)
        {
            // 부모(UE) 사망 감시 — PID 직접 감시 (고아 차단, ue5-client-design §4).
            // stdin EOF 방식은 파이프 핸들이 자식에 상속되면 EOF 가 오지 않아(Win32 함정) PID 감시가 정본.
            new Thread(() =>
            {
                try { System.Diagnostics.Process.GetProcessById(parentPid).WaitForExit(); }
                catch { /* 이미 종료됨 */ }
                Console.WriteLine($"부모(pid {parentPid}) 종료 감지 — 서버 자기 종료");
                Environment.Exit(0);
            }) { IsBackground = true }.Start();
        }

        var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        listener.Start();
        Console.WriteLine($"WC_API_PORT={port}");                    // ★ 스폰 핸드셰이크 — 형식 변경 금지
        Console.WriteLine($"WC_API_PROTOCOL={ApiProtocol.Version}");
        Console.WriteLine($"게임 API 서버: http://localhost:{port}/api/info  (종료: POST /api/shutdown 또는 Ctrl+C)");

        var running = true;
        while (running)
        {
            var ctx = listener.GetContext();
            lock (gate)
            {
                try { running = Handle(ctx, host, db); }
                catch (Exception ex) { Write(ctx, 500, new { status = "error", message = ex.Message }); }
            }
        }
        listener.Stop();
    }

    /// <summary>false 반환 = shutdown 요청 → 서버 종료.</summary>
    private static bool Handle(HttpListenerContext ctx, GameSessionHost host, GameDatabase db)
    {
        var path = ctx.Request.Url!.AbsolutePath;
        switch (ctx.Request.HttpMethod, path)
        {
            case ("GET", "/api/info"):
                Write(ctx, 200, new
                {
                    status = "ok",
                    protocol_version = ApiProtocol.Version,
                    has_campaign = host.HasCampaign,
                });
                return true;

            case ("GET", "/api/static"):
                Write(ctx, 200, StaticPayload(db));
                return true;

            case ("POST", "/api/new"):
            {
                var body = ReadBody(ctx);
                var p1 = (string?)body?["p1"] ?? throw new ArgumentException("p1 필수");
                var p2 = (string?)body?["p2"];                       // null = solo
                var seed = (ulong?)(long?)body?["seed"] ?? (ulong)Environment.TickCount64;
                Write(ctx, 200, host.NewCampaign(p1, p2, seed));
                return true;
            }
            case ("POST", "/api/load"):
            {
                var body = ReadBody(ctx);
                Write(ctx, 200, host.LoadCampaign((string?)body?["path"] ?? throw new ArgumentException("path 필수")));
                return true;
            }
            case ("POST", "/api/save"):
            {
                var body = ReadBody(ctx);
                host.SaveCampaign((string?)body?["path"] ?? throw new ArgumentException("path 필수"));
                Write(ctx, 200, new { status = "ok" });
                return true;
            }
            case ("GET", "/api/state"):
                Write(ctx, 200, host.Snapshot());
                return true;

            case ("GET", "/api/events"):
            {
                var cursor = long.TryParse(ctx.Request.QueryString["cursor"], out var c) ? c : 0;
                Write(ctx, 200, host.EventsSince(cursor));
                return true;
            }
            case ("POST", "/api/command"):
            {
                var body = ReadBody(ctx) ?? throw new ArgumentException("본문 필수");
                var result = host.Execute(
                    (long?)body["seq"] ?? throw new ArgumentException("seq 필수"),
                    (string?)body["faction"] ?? throw new ArgumentException("faction 필수"),
                    (string?)body["verb"] ?? throw new ArgumentException("verb 필수"),
                    body["args"]?.AsArray().Select(a => (string)a!).ToArray() ?? Array.Empty<string>());
                Write(ctx, result.Status == "ok" ? 200 : 422, result);
                return true;
            }
            case ("POST", "/api/shutdown"):
                Write(ctx, 200, new { status = "ok", message = "종료합니다" });
                return false;

            default:
                Write(ctx, 404, new { status = "error", message = $"미지 경로: {path}" });
                return true;
        }
    }

    /// <summary>불변 정의 — 클라 렌더에 필요한 표시 정보 전부 (맵 좌표·색·이름·병종 스펙).</summary>
    private static object StaticPayload(GameDatabase db) => new
    {
        status = "ok",
        protocol_version = ApiProtocol.Version,
        map = new
        {
            nodes = db.Map.Nodes.Values.Select(n => new
            {
                id = n.Id,
                name_ko = n.NameKo,
                type = n is Core.Domain.LandProvince ? "land" : "sea",
                region = n.Region,
                map_pos = new { x = n.MapPos.X, y = n.MapPos.Y },
                adjacent = n.Adjacent,
                terrain = (n as Core.Domain.LandProvince)?.Terrain,
                port = (n as Core.Domain.LandProvince)?.Port,
            }),
            edges = db.Map.Edges.Select(e => new { from = e.From, to = e.To, type = e.Type.ToString().ToLowerInvariant() }),
        },
        factions = db.Factions.Values.Select(f => new
        {
            id = f.Id, name_ko = f.NameKo, color = f.Color,
            player_selectable = f.IsPlayerSelectable, leader = f.LeaderCharacterId,
        }),
        characters = db.Characters.Values.Select(c => new
        {
            id = c.Id, name_ko = c.NameKo, rarity = c.Rarity, origin = c.Origin,
            portrait_asset = c.PortraitAsset,
            stats = new { ldr = c.Stats.Ldr, str = c.Stats.Str, @int = c.Stats.Int, pol = c.Stats.Pol, cha = c.Stats.Cha, nav = c.Stats.Nav },
            passive_skill = c.PassiveSkillId, ultimate_skill = c.UltimateSkillId,
        }),
        units = db.Units.Values.Select(u => new
        {
            id = u.Id, name_ko = u.NameKo, domain = u.Domain, @class = u.Class,
            atk = u.Atk, def = u.Def, speed = u.Speed,
            recruit_cost_gold = u.RecruitCostGold, upkeep_food = u.UpkeepFood,
        }),
    };

    private static JsonNode? ReadBody(HttpListenerContext ctx)
    {
        using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
        var text = reader.ReadToEnd();
        return text.Length == 0 ? null : JsonNode.Parse(text);
    }

    private static void Write(HttpListenerContext ctx, int status, object payload)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, Json));
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json; charset=utf-8";
        ctx.Response.ContentLength64 = bytes.Length;
        ctx.Response.OutputStream.Write(bytes);
        ctx.Response.Close();
    }

    /// <summary>HttpListener 는 포트 0 을 지원하지 않아 TcpListener 로 빈 포트를 찾는다 (스폰 핸드셰이크용).</summary>
    private static int FindFreePort()
    {
        var probe = new TcpListener(IPAddress.Loopback, 0);
        probe.Start();
        var port = ((IPEndPoint)probe.LocalEndpoint).Port;
        probe.Stop();
        return port;
    }
}
