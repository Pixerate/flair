// flair-metal-hash: 554b6ffa
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uBackground;
    float uThickness;
    float uProgress;
    float uDrawOn;
    float uOpacity;
    float uRim;
    float uGlow;
    float uFlow;
    uint uDownFrame;
    float uBackgroundAlpha;
};

struct flair_glass_writing_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _105)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_105.iResolution[0u], _105.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_105.iResolution[0], _105.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _139;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _139 = s.y;
    }
    else
    {
        float _148;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _148 = s.x;
        }
        else
        {
            float _158;
            if (meta.w < 1.5)
            {
                _158 = fast::min(s.x, s.y);
            }
            else
            {
                _158 = fast::max(s.x, s.y);
            }
            _148 = _158;
        }
        _139 = _148;
    }
    float k = _139;
    return float3((float2(_105.iResolution[0], _105.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _105)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _105).z;
}

static inline __attribute__((always_inline))
float2 pathUnits(thread const float3& f, thread const float2& p, constant FlairUniforms& _105)
{
    return (float2(p.x, _105.iResolution[1u] - p.y) - f.xy) / float2(f.z);
}

static inline __attribute__((always_inline))
int pathHits(texture2d<float> path, sampler pathSmplr, thread const float2& p, thread const float& radius, thread const float& gap, thread const float& from, thread const float& to, thread spvUnsafeArray<float4, 4>& hits, constant FlairUniforms& _105)
{
    for (int j = 0; j < 4; j++)
    {
        hits[j] = float4(100000002004087734272.0, 0.0, 1.0, 0.0);
    }
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    float3 f = pathFrame(path, pathSmplr, _105);
    float3 param = f;
    float2 param_1 = p;
    float2 q = pathUnits(param, param_1, _105);
    float r = radius / f.z;
    float lo = from / f.z;
    float hi = to / f.z;
    int n = int(meta.x);
    int chunks = int(meta.z);
    int count = 0;
    for (int c = 0; c < 64; c++)
    {
        if (c >= chunks)
        {
            break;
        }
        float4 bb = path.read(uint2(int2(3 + c, 1)), 0);
        float2 out_ = fast::max(fast::max(bb.xy - q, q - bb.zw), float2(0.0));
        if (dot(out_, out_) > (r * r))
        {
            continue;
        }
        int last = min(((c * 16) + 16), (n - 1));
        int _327 = c * 16;
        for (int i = _327; i < last; i++)
        {
            float4 a = path.read(uint2(int2(i, 0)), 0);
            float4 b = path.read(uint2(int2(i + 1, 0)), 0);
            bool _351 = b.w < 0.5;
            bool _359;
            if (!_351)
            {
                _359 = b.z < lo;
            }
            else
            {
                _359 = _351;
            }
            bool _367;
            if (!_359)
            {
                _367 = a.z > hi;
            }
            else
            {
                _367 = _359;
            }
            if (_367)
            {
                continue;
            }
            float span = fast::max(b.z - a.z, 9.999999717180685365747194737196e-10);
            float2 a2 = mix(a.xy, b.xy, float2(fast::clamp((lo - a.z) / span, 0.0, 1.0)));
            float2 b2 = mix(a.xy, b.xy, float2(fast::clamp((hi - a.z) / span, 0.0, 1.0)));
            float z0 = fast::max(a.z, lo);
            float z1 = fast::min(b.z, hi);
            float2 ab = b2 - a2;
            float2 aq = q - a2;
            float h = fast::clamp(dot(aq, ab) / fast::max(dot(ab, ab), 9.9999999600419720025001879548654e-13), 0.0, 1.0);
            float2 e = aq - (ab * h);
            float d = length(e);
            if (d > r)
            {
                continue;
            }
            float4 hit = float4(d * f.z, mix(z0, z1, h) * f.z, (((ab.x * aq.y) - (ab.y * aq.x)) < 0.0) ? (-1.0) : 1.0, 1.0);
            int slot = -1;
            int worst = 0;
            for (int j_1 = 0; j_1 < 4; j_1++)
            {
                bool _491 = j_1 < count;
                bool _503;
                if (_491)
                {
                    _503 = abs(hits[j_1].y - hit.y) < gap;
                }
                else
                {
                    _503 = _491;
                }
                if (_503)
                {
                    slot = j_1;
                }
                if (hits[j_1].x > hits[worst].x)
                {
                    worst = j_1;
                }
            }
            if (slot >= 0)
            {
                if (hit.x < hits[slot].x)
                {
                    hits[slot] = hit;
                }
            }
            else
            {
                if (count < 4)
                {
                    hits[count] = hit;
                    count++;
                }
                else
                {
                    if (hit.x < hits[worst].x)
                    {
                        hits[worst] = hit;
                    }
                }
            }
        }
    }
    return count;
}

static inline __attribute__((always_inline))
float3 tubeTint(thread float& t, constant FlairUniforms& _105)
{
    t = fast::clamp(t, 0.0, 1.0);
    float3 _567;
    if (t < 0.5)
    {
        _567 = mix(_105.uColorA, _105.uColorB, float3(t * 2.0));
    }
    else
    {
        _567 = mix(_105.uColorB, _105.uColorC, float3((t * 2.0) - 1.0));
    }
    return _567;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _105, texture2d<float> uPath, sampler uPathSmplr)
{
    float r = ((0.5 * _105.uThickness) / 100.0) * fast::min(_105.iResolution[0u], _105.iResolution[1u]);
    float total = pathLength(uPath, uPathSmplr, _105);
    float _615;
    if (_105.uDrawOn > 0.0)
    {
        _615 = fast::min(_105.uProgress, _105.iTime / _105.uDrawOn);
    }
    else
    {
        _615 = _105.uProgress;
    }
    float drawn = _615;
    float reach = r * (1.0 + (2.0 * fast::min(_105.uGlow, 1.0)));
    float2 param = fragCoord;
    float param_1 = reach;
    float param_2 = 2.5 * r;
    float param_3 = 0.0;
    float param_4 = total * fast::clamp(drawn, 0.0, 1.0);
    spvUnsafeArray<float4, 4> param_5;
    int _657 = pathHits(uPath, uPathSmplr, param, param_1, param_2, param_3, param_4, param_5, _105);
    spvUnsafeArray<float4, 4> hits = param_5;
    int n = _657;
    for (int i = 0; i < 3; i++)
    {
        for (int j = 0; j < (3 - i); j++)
        {
            bool _680 = (j + 1) < n;
            bool _691;
            if (_680)
            {
                _691 = hits[j].y > hits[j + 1].y;
            }
            else
            {
                _691 = _680;
            }
            if (_691)
            {
                float4 s = hits[j];
                hits[j] = hits[j + 1];
                hits[j + 1] = s;
            }
        }
    }
    float3 col = float3(_105.uBackground);
    float frameT = 1.0 - (fragCoord.y / _105.iResolution[1u]);
    float _751;
    for (int i_1 = 0; i_1 < 4; i_1++)
    {
        if (i_1 >= n)
        {
            break;
        }
        float4 h = hits[i_1];
        float x = h.x / r;
        if (_105.uDownFrame != 0u)
        {
            _751 = frameT;
        }
        else
        {
            _751 = h.y / fast::max(total, 1.0);
        }
        float param_6 = _751;
        float3 _763 = tubeTint(param_6, _105);
        float3 tint = _763;
        col += ((((tint * _105.uGlow) * 0.3499999940395355224609375) * exp((-2.5) * fast::max(x - 1.0, 0.0))) * (1.0 - smoothstep(0.0, 1.0, 1.0 - x)));
        if (x >= 1.0)
        {
            continue;
        }
        float across = x * h.z;
        float nz = sqrt(fast::max(1.0 - (x * x), 0.0));
        float fresnel = powr(1.0 - nz, 2.0);
        float spec = powr(fast::max(0.0, 1.0 - (abs(across - 0.5) / 0.2199999988079071044921875)), 3.0);
        float glint = powr(0.5 + (0.5 * sin((h.y - (((_105.iTime * _105.uFlow) * r) * 4.0)) / (r * 3.0))), 12.0);
        float3 body = tint * (0.07999999821186065673828125 + ((0.300000011920928955078125 * nz) * nz));
        float3 edge = (tint * _105.uRim) * ((1.60000002384185791015625 * fresnel) + (0.89999997615814208984375 * powr(x, 10.0)));
        float3 tube = (body + edge) + ((mix(tint, float3(1.0), float3(0.5)) * ((0.449999988079071044921875 * spec) + ((0.300000011920928955078125 * glint) * nz))) * _105.uRim);
        float a = mix(_105.uOpacity, 1.0, fresnel) * smoothstep(r, r - 1.5, h.x);
        col = mix(col, tube, float3(a));
    }
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _953;
    if (a > 0.0)
    {
        _953 = bg + (d / float3(a));
    }
    else
    {
        _953 = bg;
    }
    float3 fg = _953;
    float alpha = a + (opacity * (1.0 - a));
    float3 _975;
    if (alpha > 0.0)
    {
        _975 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _975 = bg;
    }
    float3 col = _975;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _105, texture2d<float> uPath, sampler uPathSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _105, uPath, uPathSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_105.uBackground);
    float param_4 = _105.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_glass_writing_frag_out flair_glass_writing_frag(constant FlairUniforms& _105 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_glass_writing_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1032;
    if (_105.flair_flipY > 0.5)
    {
        _1032 = _105.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1032 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1032);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _105, uPath, uPathSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

