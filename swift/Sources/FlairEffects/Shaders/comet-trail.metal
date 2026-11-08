// flair-metal-hash: a3825a52
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uHead;
    packed_float3 uTail;
    float uWidth;
    float uHeadSize;
    float uGlow;
    float uLife;
    float uIntensity;
    uint uDemo;
};

struct flair_comet_trail_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _104)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_104.iResolution[0u], _104.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_104.iResolution[0], _104.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _138;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _138 = s.y;
    }
    else
    {
        float _147;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _147 = s.x;
        }
        else
        {
            float _157;
            if (meta.w < 1.5)
            {
                _157 = fast::min(s.x, s.y);
            }
            else
            {
                _157 = fast::max(s.x, s.y);
            }
            _147 = _157;
        }
        _138 = _147;
    }
    float k = _138;
    return float3((float2(_104.iResolution[0], _104.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _104)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _104).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _104)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _104);
    float s = fast::clamp(along / f.z, 0.0, meta.y);
    int lo = 0;
    int hi = n - 1;
    for (int k = 0; k < 11; k++)
    {
        if ((hi - lo) <= 1)
        {
            break;
        }
        int mid = (lo + hi) / 2;
        if (path.read(uint2(int2(mid, 0)), 0).z <= s)
        {
            lo = mid;
        }
        else
        {
            hi = mid;
        }
    }
    float4 a = path.read(uint2(int2(lo, 0)), 0);
    float4 b = path.read(uint2(int2(hi, 0)), 0);
    float2 _282;
    if (b.w < 0.5)
    {
        _282 = a.xy;
    }
    else
    {
        _282 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _282;
    float2 t = b.xy - a.xy;
    float2 _318;
    if (dot(t, t) > 0.0)
    {
        _318 = fast::normalize(t);
    }
    else
    {
        _318 = float2(1.0, 0.0);
    }
    t = _318;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _104.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _104, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.60000002384185791015625;
    float len = pathLength(uPath, uPathSmplr, _104);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _104).xy - pathAt(uPath, uPathSmplr, param_1, _104).xy) < 2.0;
        float _376;
        if (closed)
        {
            _376 = fract(lap) * len;
        }
        else
        {
            _376 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _376;
        return pathAt(uPath, uPathSmplr, param_2, _104).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_104.iResolution[0], _104.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailPoint(thread const int& i, thread const bool& demo, constant FlairUniforms& _104, texture2d<float> uPath, sampler uPathSmplr)
{
    bool _458 = !demo;
    bool _473;
    if (!_458)
    {
        bool _465 = _104.iTrail[0].w > 0.5;
        bool _472;
        if (_465)
        {
            _472 = _104.iPointer.z > 0.0;
        }
        else
        {
            _472 = _465;
        }
        _473 = _472;
    }
    else
    {
        _473 = _458;
    }
    if (_473)
    {
        return _104.iTrail[i];
    }
    float _484;
    if (i == 0)
    {
        _484 = _104.iTime;
    }
    else
    {
        _484 = ((floor(_104.iTime / 0.033330000936985015869140625) + 1.0) - float(i)) * 0.033330000936985015869140625;
    }
    float t = _484;
    float param = t;
    return float4(demoPath(param, _104, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _104)
{
    bool _440 = (a.z - b.z) > 0.25;
    bool _454;
    if (_440)
    {
        _454 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * _104.iResolution[1u]);
    }
    else
    {
        _454 = _440;
    }
    return _454;
}

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return float2(length((p - a) - (ab * t)), t);
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _104, texture2d<float> uPath, sampler uPathSmplr)
{
    float px = 1.0 / _104.iResolution[1u];
    float2 p = fragCoord * px;
    int param = 0;
    bool param_1 = _104.uDemo != 0u;
    float4 a = trailPoint(param, param_1, _104, uPath, uPathSmplr);
    if (a.w < 0.5)
    {
        fragColor = float4(0.0);
        return;
    }
    float2 head = a.xy * px;
    float core = 0.0;
    float halo = 0.0;
    float bestU = 0.0;
    float bestLight = -1.0;
    for (int k = 0; k < 31; k++)
    {
        int param_2 = k + 1;
        bool param_3 = _104.uDemo != 0u;
        float4 b = trailPoint(param_2, param_3, _104, uPath, uPathSmplr);
        bool _622 = b.w < 0.5;
        bool _631;
        if (!_622)
        {
            float4 param_4 = a;
            float4 param_5 = b;
            _631 = trailJump(param_4, param_5, _104);
        }
        else
        {
            _631 = _622;
        }
        if (_631)
        {
            break;
        }
        float2 param_6 = p;
        float2 param_7 = a.xy * px;
        float2 param_8 = b.xy * px;
        float2 s = segment(param_6, param_7, param_8);
        float u = (float(k) + s.y) / 31.0;
        float age = _104.iTime - mix(a.z, b.z, s.y);
        float fade = (1.0 - u) * fast::clamp(1.0 - (age / _104.uLife), 0.0, 1.0);
        float w = (_104.uWidth * mix(1.0, 0.119999997317790985107421875, u)) * sqrt(fade);
        float sd = s.x - w;
        float c = (1.0 - smoothstep(-px, px, sd)) * fade;
        float g = (((exp((-fast::max(sd, 0.0)) / ((_104.uWidth * 1.39999997615814208984375) + px)) * fade) * fade) * _104.uGlow) * 0.60000002384185791015625;
        core = fast::max(core, c);
        halo = fast::max(halo, g);
        if ((c + g) > bestLight)
        {
            bestLight = c + g;
            bestU = u;
        }
        a = b;
    }
    float3 tint = mix(_104.uHead, float3(_104.uTail), float3(smoothstep(0.0, 0.75, bestU)));
    float3 col = (tint * halo) + ((mix(tint, float3(1.0), float3(0.449999988079071044921875)) * core) * 1.5);
    int param_9 = 0;
    bool param_10 = _104.uDemo != 0u;
    float4 h0 = trailPoint(param_9, param_10, _104, uPath, uPathSmplr);
    float headFade = fast::clamp(1.0 - ((_104.iTime - h0.z) / (_104.uLife * 2.0)), 0.0, 1.0);
    float r = length(p - head);
    float sz = fast::max(_104.uHeadSize, px);
    col += (((float3(1.0, 0.980000019073486328125, 0.939999997615814208984375) * exp(((-r) * r) / ((sz * sz) * 0.3499999940395355224609375))) * 2.5) * headFade);
    col += ((((_104.uHead * (sz / (r + sz))) * exp((-r) / (sz * 8.0))) * _104.uGlow) * headFade);
    float3 param_11 = col * _104.uIntensity;
    float4 _851 = glow(param_11);
    fragColor = _851;
}

fragment flair_comet_trail_frag_out flair_comet_trail_frag(constant FlairUniforms& _104 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_comet_trail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _864;
    if (_104.flair_flipY > 0.5)
    {
        _864 = _104.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _864 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _864);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _104, uPath, uPathSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

