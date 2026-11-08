// flair-metal-hash: 9dda83a3
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
    float3 uBackground;
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uColorD;
    float uLanes;
    float uDensity;
    float uWidth;
    float uGlow;
    float uSpeed;
    float uPulses;
    float uScroll;
    float uGrid;
    float uBackgroundAlpha;
};

struct flair_neon_circuit_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float laneOf(thread const float& k, thread const float& j)
{
    float2 param = float2(k, j) + float2(0.37000000476837158203125);
    return ((3.0 * k) + floor(hash12(param) * 3.0)) + 0.5;
}

static inline __attribute__((always_inline))
float arcDist(thread const float2& p, thread const float2& c, thread const float2& q)
{
    float2 d = p - c;
    bool _174 = (d.x * q.x) >= 0.0;
    bool _183;
    if (_174)
    {
        _183 = (d.y * q.y) >= 0.0;
    }
    else
    {
        _183 = _174;
    }
    float _184;
    if (_183)
    {
        _184 = abs(length(d) - 0.3499999940395355224609375);
    }
    else
    {
        _184 = 100000.0;
    }
    return _184;
}

static inline __attribute__((always_inline))
float4 run(thread const float2& p, thread const float& k, thread const float& j)
{
    float param = k;
    float param_1 = j - 1.0;
    float x0 = laneOf(param, param_1);
    float param_2 = k;
    float param_3 = j;
    float x1 = laneOf(param_2, param_3);
    float param_4 = k;
    float param_5 = j + 1.0;
    float x2 = laneOf(param_4, param_5);
    float y0 = j * 2.5;
    float y1 = y0 + 2.5;
    float lo = y0 + ((x0 == x1) ? 0.0 : 0.3499999940395355224609375);
    float hi = y1 - ((x2 == x1) ? 0.0 : 0.3499999940395355224609375);
    float4 r = float4(length(p - float2(x1, fast::clamp(p.y, lo, hi))), p.y - y0, 100000.0, 0.0);
    if (x2 != x1)
    {
        float sx = sign(x2 - x1);
        float h = length(p - float2(fast::clamp(p.x, fast::min(x1, x2) + 0.3499999940395355224609375, fast::max(x1, x2) - 0.3499999940395355224609375), y1));
        float2 param_6 = p;
        float2 param_7 = float2(x1 + (sx * 0.3499999940395355224609375), y1 - 0.3499999940395355224609375);
        float2 param_8 = float2(-sx, 1.0);
        h = fast::min(h, arcDist(param_6, param_7, param_8));
        float2 param_9 = p;
        float2 param_10 = float2(x2 - (sx * 0.3499999940395355224609375), y1 + 0.3499999940395355224609375);
        float2 param_11 = float2(sx, -1.0);
        h = fast::min(h, arcDist(param_9, param_10, param_11));
        float2 _323 = float2(h, 2.5 + abs(p.x - x1));
        r.z = _323.x;
        r.w = _323.y;
    }
    return r;
}

static inline __attribute__((always_inline))
float pulseAt(thread const float& k, thread const float& j, thread const float& s, constant FlairUniforms& _131)
{
    float2 param = float2(k, 8.80000019073486328125);
    float cycle = ((_131.iTime * _131.uSpeed) * 1.5) + hash12(param);
    float param_1 = k;
    float param_2 = j + 1.0;
    float param_3 = k;
    float param_4 = j;
    float behind = (fract(cycle) * (2.5 + abs(laneOf(param_1, param_2) - laneOf(param_3, param_4)))) - s;
    float2 param_5 = float2(k, floor(cycle) - j);
    float lit = step(hash12(param_5), _131.uPulses);
    float _385;
    if (behind >= 0.0)
    {
        _385 = exp((-behind) * 0.800000011920928955078125);
    }
    else
    {
        _385 = exp(behind * 30.0);
    }
    return lit * _385;
}

static inline __attribute__((always_inline))
float3 traceColor(thread const float& k, constant FlairUniforms& _131)
{
    float2 param = float2(k, 7.30000019073486328125);
    float h = hash12(param);
    float3 _119;
    if (h < 0.25)
    {
        _119 = _131.uColorA;
    }
    else
    {
        float3 _139;
        if (h < 0.5)
        {
            _139 = _131.uColorB;
        }
        else
        {
            float3 _149;
            if (h < 0.75)
            {
                _149 = _131.uColorC;
            }
            else
            {
                _149 = float3(_131.uColorD);
            }
            _139 = _149;
        }
        _119 = _139;
    }
    return _119;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _131)
{
    float px = _131.uLanes / _131.iResolution[1u];
    float2 p = fragCoord * px;
    p.y += (_131.iTime * _131.uScroll);
    float2 g = abs(fract(p / float2(1.5)) - float2(0.5));
    float grid = 1.0 - smoothstep(0.0, px * 1.5, (0.5 - fast::max(g.x, g.y)) * 1.5);
    float3 light = ((float3(_131.uColorD) * 0.119999997317790985107421875) * _131.uGrid) * grid;
    float home = floor(p.x / 3.0);
    for (int i = -1; i <= 1; i++)
    {
        float k = home + float(i);
        float2 param = float2(k, 1.89999997615814208984375);
        if (hash12(param) > _131.uDensity)
        {
            continue;
        }
        float2 param_1 = float2(k, 4.099999904632568359375);
        float2 q = float2(p.x, p.y + (hash12(param_1) * 2.5));
        float jq = floor(q.y / 2.5);
        float w = _131.uWidth * 0.5;
        float d = 100000.0;
        float pulse = 0.0;
        for (int b = -1; b <= 1; b++)
        {
            float j = jq + float(b);
            float2 param_2 = q;
            float param_3 = k;
            float param_4 = j;
            float4 r = run(param_2, param_3, param_4);
            d = fast::min(d, fast::min(r.x, r.z));
            float param_5 = k;
            float param_6 = j;
            float param_7 = r.y;
            pulse = fast::max(pulse, pulseAt(param_5, param_6, param_7, _131) * exp((-r.x) / _131.uWidth));
            if (r.z < 10000.0)
            {
                float param_8 = k;
                float param_9 = j;
                float param_10 = r.w;
                pulse = fast::max(pulse, pulseAt(param_8, param_9, param_10, _131) * exp((-r.z) / _131.uWidth));
            }
        }
        float core = 1.0 - smoothstep(w - px, w + px, d);
        float glow = _131.uGlow * ((0.5 * exp((-d) / _131.uWidth)) + (0.20000000298023223876953125 * exp((-d) / (_131.uWidth * 5.0))));
        float param_11 = k;
        float3 c = traceColor(param_11, _131);
        light += ((c * (((core * 0.800000011920928955078125) + glow) + (_131.uGlow * pulse))) + (((mix(c, float3(1.0), float3(0.699999988079071044921875)) * core) * pulse) * 3.0));
    }
    fragColor = float4(_131.uBackground + (float3(1.0) - exp((-light) * 1.39999997615814208984375)), 1.0);
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
    float3 _706;
    if (a > 0.0)
    {
        _706 = bg + (d / float3(a));
    }
    else
    {
        _706 = bg;
    }
    float3 fg = _706;
    float alpha = a + (opacity * (1.0 - a));
    float3 _728;
    if (alpha > 0.0)
    {
        _728 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _728 = bg;
    }
    float3 col = _728;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _131)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _131);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _131.uBackground;
    float param_4 = _131.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_neon_circuit_frag_out flair_neon_circuit_frag(constant FlairUniforms& _131 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_neon_circuit_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _785;
    if (_131.flair_flipY > 0.5)
    {
        _785 = _131.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _785 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _785);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _131);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

