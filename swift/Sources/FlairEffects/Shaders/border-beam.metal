// flair-metal-hash: cdab6338
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float3 uTail;
    packed_float3 uBorder;
    float uBorderAlpha;
    float uInset;
    float uRadius;
    float uThickness;
    float uLength;
    float uLaps;
    int uBeams;
    float uGlow;
};

struct flair_border_beam_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _173)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_173.iResolution[0u], _173.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_173.iResolution[0], _173.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _206;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _206 = s.y;
    }
    else
    {
        float _215;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _215 = s.x;
        }
        else
        {
            float _225;
            if (meta.w < 1.5)
            {
                _225 = fast::min(s.x, s.y);
            }
            else
            {
                _225 = fast::max(s.x, s.y);
            }
            _215 = _225;
        }
        _206 = _215;
    }
    float k = _206;
    return float3((float2(_173.iResolution[0], _173.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _173)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _173).z;
}

static inline __attribute__((always_inline))
float2 pathUnits(thread const float3& f, thread const float2& p, constant FlairUniforms& _173)
{
    return (float2(p.x, _173.iResolution[1u] - p.y) - f.xy) / float2(f.z);
}

static inline __attribute__((always_inline))
float4 pathNearest(texture2d<float> path, sampler pathSmplr, thread const float2& p, thread const float& from, thread const float& to, constant FlairUniforms& _173)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    float3 f = pathFrame(path, pathSmplr, _173);
    float3 param = f;
    float2 param_1 = p;
    float2 q = pathUnits(param, param_1, _173);
    float lo = from / f.z;
    float hi = to / f.z;
    int n = int(meta.x);
    int chunks = int(meta.z);
    float best = 100000002004087734272.0;
    float4 found = float4(100000002004087734272.0, 0.0, 1.0, 0.0);
    for (int c = 0; c < 64; c++)
    {
        if (c >= chunks)
        {
            break;
        }
        float4 bb = path.read(uint2(int2(3 + c, 1)), 0);
        float2 out_ = fast::max(fast::max(bb.xy - q, q - bb.zw), float2(0.0));
        if (dot(out_, out_) >= best)
        {
            continue;
        }
        int last = min(((c * 16) + 16), (n - 1));
        int _375 = c * 16;
        for (int i = _375; i < last; i++)
        {
            float4 a = path.read(uint2(int2(i, 0)), 0);
            float4 b = path.read(uint2(int2(i + 1, 0)), 0);
            bool _399 = b.w < 0.5;
            bool _407;
            if (!_399)
            {
                _407 = b.z < lo;
            }
            else
            {
                _407 = _399;
            }
            bool _415;
            if (!_407)
            {
                _415 = a.z > hi;
            }
            else
            {
                _415 = _407;
            }
            if (_415)
            {
                continue;
            }
            float span = fast::max(b.z - a.z, 9.999999717180685365747194737196e-10);
            float2 a2 = mix(a.xy, b.xy, float2(fast::clamp((lo - a.z) / span, 0.0, 1.0)));
            float2 b2 = mix(a.xy, b.xy, float2(fast::clamp((hi - a.z) / span, 0.0, 1.0)));
            float2 ab = b2 - a2;
            float2 aq = q - a2;
            float h = fast::clamp(dot(aq, ab) / fast::max(dot(ab, ab), 9.9999999600419720025001879548654e-13), 0.0, 1.0);
            float2 e = aq - (ab * h);
            float dd = dot(e, e);
            if (dd < best)
            {
                best = dd;
                found = float4(sqrt(dd) * f.z, mix(fast::max(a.z, lo), fast::min(b.z, hi), h) * f.z, (((ab.x * aq.y) - (ab.y * aq.x)) < 0.0) ? (-1.0) : 1.0, 1.0);
            }
        }
    }
    return found;
}

static inline __attribute__((always_inline))
float4 pathNearest(texture2d<float> path, sampler pathSmplr, thread const float2& p, constant FlairUniforms& _173)
{
    float2 param = p;
    float param_1 = 0.0;
    float param_2 = 100000002004087734272.0;
    return pathNearest(path, pathSmplr, param, param_1, param_2, _173);
}

static inline __attribute__((always_inline))
float boxSdf(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
float framePos(thread const float2& q, thread const float2& c, thread const float& r)
{
    float lc = 1.5707962512969970703125 * r;
    float lx = 2.0 * c.x;
    float ly = 2.0 * c.y;
    float2 a = abs(q);
    bool _556 = a.x > c.x;
    bool _564;
    if (_556)
    {
        _564 = a.y > c.y;
    }
    else
    {
        _564 = _556;
    }
    if (_564)
    {
        float _571;
        if (q.x > 0.0)
        {
            _571 = c.x;
        }
        else
        {
            _571 = -c.x;
        }
        float _584;
        if (q.y > 0.0)
        {
            _584 = c.y;
        }
        else
        {
            _584 = -c.y;
        }
        float2 k = float2(_571, _584);
        float ang = precise::atan2(q.y - k.y, q.x - k.x);
        if (ang < 0.0)
        {
            ang += 6.283185482025146484375;
        }
        bool _616 = q.x > 0.0;
        bool _622;
        if (_616)
        {
            _622 = q.y > 0.0;
        }
        else
        {
            _622 = _616;
        }
        if (_622)
        {
            return ly + (r * ang);
        }
        if (q.y > 0.0)
        {
            return ((ly + lc) + lx) + (r * (ang - 1.5707962512969970703125));
        }
        if (q.x < 0.0)
        {
            return (((2.0 * ly) + (2.0 * lc)) + lx) + (r * (ang - 3.1415927410125732421875));
        }
        return (((2.0 * ly) + (3.0 * lc)) + (2.0 * lx)) + (r * (ang - 4.7123889923095703125));
    }
    bool _688 = a.x > c.x;
    bool _711;
    if (!_688)
    {
        bool _696 = a.y <= c.y;
        bool _710;
        if (_696)
        {
            _710 = (c.x - a.x) < (c.y - a.y);
        }
        else
        {
            _710 = _696;
        }
        _711 = _710;
    }
    else
    {
        _711 = _688;
    }
    bool side = _711;
    if (side)
    {
        float _718;
        if (q.x > 0.0)
        {
            _718 = q.y + c.y;
        }
        else
        {
            _718 = ((ly + (2.0 * lc)) + lx) + (c.y - q.y);
        }
        return _718;
    }
    float _744;
    if (q.y > 0.0)
    {
        _744 = (ly + lc) + (c.x - q.x);
    }
    else
    {
        _744 = (((2.0 * ly) + (3.0 * lc)) + lx) + (q.x + c.x);
    }
    return _744;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _173, texture2d<float> uPath, sampler uPathSmplr)
{
    float px = 1.0 / _173.iResolution[1u];
    float2 p = (fragCoord - (float2(_173.iResolution[0], _173.iResolution[1]) * 0.5)) * px;
    float2 box = fast::max(((float2(_173.iResolution[0], _173.iResolution[1]) * 0.5) * px) - float2(_173.uInset), float2(0.0199999995529651641845703125));
    float rad = fast::min(_173.uRadius, fast::min(box.x, box.y));
    float2 c = box - float2(rad);
    bool onPath = pathLength(uPath, uPathSmplr, _173) > 0.0;
    float4 _822;
    if (onPath)
    {
        float2 param = fragCoord;
        _822 = pathNearest(uPath, uPathSmplr, param, _173);
    }
    else
    {
        _822 = float4(0.0);
    }
    float4 near = _822;
    float _833;
    if (onPath)
    {
        _833 = near.x * px;
    }
    else
    {
        float2 param_1 = p;
        float2 param_2 = box;
        float param_3 = rad;
        _833 = boxSdf(param_1, param_2, param_3);
    }
    float sd = _833;
    float w = fast::max(_173.uThickness, px);
    float core = fast::clamp(1.0 - ((abs(sd) - (0.5 * w)) / px), 0.0, 1.0);
    float halo = exp((-abs(sd)) / (w + 0.01200000010430812835693359375));
    float4 acc = float4(0.0);
    float4 param_4 = acc;
    float3 param_5 = float3(_173.uBorder);
    float param_6 = _173.uBorderAlpha * core;
    acc = over(param_4, param_5, param_6);
    if (abs(sd) > (0.0599999986588954925537109375 + (3.0 * w)))
    {
        float4 param_7 = acc;
        fragColor = unpremultiply(param_7);
        return;
    }
    float perim = (4.0 * (c.x + c.y)) + (6.283185482025146484375 * rad);
    float _913;
    if (onPath)
    {
        _913 = near.y / pathLength(uPath, uPathSmplr, _173);
    }
    else
    {
        float2 param_8 = p;
        float2 param_9 = c;
        float param_10 = rad;
        _913 = framePos(param_8, param_9, param_10) / perim;
    }
    float s = _913;
    float beam = 0.0;
    float behind = 1.0;
    float _979;
    for (int i = 0; i < 4; i++)
    {
        if (i >= _173.uBeams)
        {
            break;
        }
        float head = fract(((_173.iTime * _173.uLaps) / 5.0) + (float(i) / float(_173.uBeams)));
        float d = fract(head - s);
        if (d < _173.uLength)
        {
            _979 = powr(1.0 - (d / _173.uLength), 1.2000000476837158203125) * smoothstep(0.0, 0.01200000010430812835693359375, d);
        }
        else
        {
            _979 = 0.0;
        }
        float k = _979;
        if (k > beam)
        {
            beam = k;
            behind = d / _173.uLength;
        }
    }
    float3 col = mix(_173.uHead, _173.uTail, float3(smoothstep(0.0, 0.699999988079071044921875, behind)));
    float4 param_11 = acc;
    float3 param_12 = col;
    float param_13 = fast::clamp(((beam * halo) * _173.uGlow) * 0.699999988079071044921875, 0.0, 1.0);
    acc = over(param_11, param_12, param_13);
    float4 param_14 = acc;
    float3 param_15 = mix(col, float3(1.0), float3((0.449999988079071044921875 * beam) * beam));
    float param_16 = fast::clamp((beam * core) * 1.39999997615814208984375, 0.0, 1.0);
    acc = over(param_14, param_15, param_16);
    float4 param_17 = acc;
    fragColor = unpremultiply(param_17);
}

fragment flair_border_beam_frag_out flair_border_beam_frag(constant FlairUniforms& _173 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_border_beam_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1068;
    if (_173.flair_flipY > 0.5)
    {
        _1068 = _173.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1068 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1068);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _173, uPath, uPathSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

