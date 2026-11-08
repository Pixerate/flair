// flair-metal-hash: cce7c525
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
    float uScale;
    float uSpeed;
    float uDensity;
    float uAmount;
    float uTail;
    float uTurbulence;
    float uBrightness;
    float3 uSlow;
    float3 uFast;
    packed_float3 uBackground;
    uint uTransparent;
    float uBackgroundAlpha;
};

struct flair_flow_particles_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 cornerHashes(thread const float2& i)
{
    float2 x = fract(float2(i.x, i.x + 1.0) * 0.103100001811981201171875);
    float2 y = fract(float2(i.y, i.y + 1.0) * 0.103100001811981201171875);
    float4 X = x.xyxy;
    float4 Y = y.xxyy;
    float4 d = ((X * (Y + float4(33.3300018310546875))) + (Y * (X + float4(33.3300018310546875)))) + (X * (X + float4(33.3300018310546875)));
    float4 px = X + d;
    return fract((px + (Y + d)) * px);
}

static inline __attribute__((always_inline))
float2 vnoiseGrad(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 du = (f * 6.0) * (float2(1.0) - f);
    float2 param = i;
    float4 h = cornerHashes(param);
    float k = ((h.x - h.y) - h.z) + h.w;
    return du * float2((h.y - h.x) + (k * u.y), (h.z - h.x) + (k * u.x));
}

static inline __attribute__((always_inline))
float2 flow(thread const float2& p, thread const float& t, constant FlairUniforms& _285)
{
    float2 param = p + float2(t, (-0.60000002384185791015625) * t);
    float2 g = vnoiseGrad(param);
    if (_285.uTurbulence > 0.0)
    {
        float2 param_1 = ((p * 2.2999999523162841796875) - float2(0.699999988079071044921875 * t, t)) + float2(9.1000003814697265625);
        g += (vnoiseGrad(param_1) * (_285.uTurbulence * 1.14999997615814208984375));
    }
    return float2(g.y, -g.x) + float2(0.3499999940395355224609375, 0.07999999821186065673828125);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _285)
{
    float2 q = fragCoord / float2(_285.iResolution[1u]);
    float cell = 1.0 / _285.uDensity;
    float ft = (_285.iTime * _285.uSpeed) * 0.039999999105930328369140625;
    float tail = fast::max(_285.uTail * 24.0, 1.0);
    float3 col = float3(0.0);
    float2 cellAt = float2(-1000000000.0);
    bool alive = false;
    float life = 0.0;
    float2 at = float2(0.0);
    float2 v = float2(0.0);
    float sp = 0.0;
    for (int k = 0; k < 24; k++)
    {
        if ((k & 1) == 0)
        {
            float2 param = q * _285.uScale;
            float param_1 = ft;
            v = flow(param, param_1, _285);
            sp = length(v);
        }
        float2 c = floor(q * _285.uDensity);
        if (any(c != cellAt))
        {
            cellAt = c;
            float2 param_2 = c + float2(0.310000002384185791015625);
            float h0 = hash12(param_2);
            float2 param_3 = c + float2(7.69999980926513671875);
            float phase = ((_285.iTime * _285.uSpeed) * (0.300000011920928955078125 + (0.300000011920928955078125 * h0))) + hash12(param_3);
            life = fract(phase);
            float cyc = floor(phase);
            float2 param_4 = (c * 1.7000000476837158203125) + float2(cyc * 3.099999904632568359375);
            alive = hash12(param_4) < _285.uAmount;
            if (alive)
            {
                float2 param_5 = c + float2(cyc * 17.1299991607666015625);
                at = ((c + float2(0.25)) + (hash22(param_5) * 0.5)) * cell;
            }
        }
        float behind = (life * 24.0) - float(k);
        if ((alive && (behind >= 0.0)) && (behind < tail))
        {
            float2 dq = (q - at) / float2(cell);
            float d2 = dot(dq, dq);
            if (d2 < 0.328999996185302734375)
            {
                float spot = exp((-d2) * 14.0);
                float w = 1.0 - (behind / tail);
                float fade = smoothstep(0.0, 0.07999999821186065673828125, life) * (1.0 - smoothstep(0.75, 1.0, life));
                float3 hue = mix(_285.uSlow, _285.uFast, float3(smoothstep(0.300000011920928955078125, 2.2000000476837158203125, sp)));
                col += (((((hue * spot) * w) * w) * fade) * (0.60000002384185791015625 + (1.60000002384185791015625 * exp((-behind) * 1.2000000476837158203125))));
            }
        }
        q -= (((v / float2(fast::max(sp, 0.001000000047497451305389404296875))) * cell) * fast::min(0.2199999988079071044921875 * (0.60000002384185791015625 + sp), 0.449999988079071044921875));
    }
    col *= _285.uBrightness;
    if (_285.uTransparent != 0u)
    {
        float3 param_6 = col;
        float4 _591 = glow(param_6);
        fragColor = _591;
    }
    else
    {
        fragColor = float4(float3(_285.uBackground) + ((float3(1.0) - exp(-col)) * (float3(1.0) - float3(_285.uBackground))), 1.0);
    }
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
    float3 _654;
    if (a > 0.0)
    {
        _654 = bg + (d / float3(a));
    }
    else
    {
        _654 = bg;
    }
    float3 fg = _654;
    float alpha = a + (opacity * (1.0 - a));
    float3 _676;
    if (alpha > 0.0)
    {
        _676 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _676 = bg;
    }
    float3 col = _676;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _285)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _285);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_285.uBackground);
    float param_4 = _285.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_flow_particles_frag_out flair_flow_particles_frag(constant FlairUniforms& _285 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_flow_particles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _732;
    if (_285.flair_flipY > 0.5)
    {
        _732 = _285.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _732 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _732);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _285);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

