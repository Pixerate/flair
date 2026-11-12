// flair-metal-hash: a43523e0
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float3 uPaper;
    float3 uPaper2;
    packed_float3 uInk;
    float uLines;
    float uCount;
    float uLength;
    float uWidth;
    float uSpeed;
    float uFlutter;
    float uTwist;
};

struct flair_paper_shreds_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _170)
{
    float2 p = (fragCoord - (float2(_170.iResolution[0], _170.iResolution[1]) * 0.5)) / float2(_170.iResolution[1u]);
    float px = 1.0 / _170.iResolution[1u];
    float4 acc = float4(0.0);
    float cw = (_170.iResolution[0u] / _170.iResolution[1u]) / _170.uCount;
    float3 _485;
    for (int l = 2; l >= 0; l--)
    {
        float sc = 1.0 - (0.2199999988079071044921875 * float(l));
        float2 pl = p / float2(sc);
        float col = floor(pl.x / cw);
        for (int k = -1; k <= 1; k++)
        {
            float c = col + float(k);
            float2 param = float2(c, float(l)) + float2(0.709999978542327880859375);
            float2 param_1 = float2(c, float(l)) + float2(5.30000019073486328125);
            float4 h = float4(hash22(param), hash22(param_1));
            float L = _170.uLength * (0.699999988079071044921875 + (0.5 * h.x));
            float span = ((1.0 / sc) + L) + 0.20000000298023223876953125;
            float t = _170.iTime * (0.800000011920928955078125 + (0.5 * h.y));
            float y = (((0.5 / sc) + (0.5 * L)) + 0.100000001490116119384765625) - mod(((_170.iTime * _170.uSpeed) * (0.800000011920928955078125 + (0.4000000059604644775390625 * h.z))) + (h.w * span), span);
            float swing = sin((t * 1.7000000476837158203125) + (h.z * 6.280000209808349609375));
            float x = (((c + 0.5) + (0.4000000059604644775390625 * (h.w - 0.5))) * cw) + (((_170.uFlutter * cw) * 0.300000011920928955078125) * swing);
            float tilt = ((_170.uFlutter * 0.449999988079071044921875) * cos((t * 1.7000000476837158203125) + (h.z * 6.280000209808349609375))) + (0.5 * (h.x - 0.5));
            float param_2 = -tilt;
            float2 d = rot(param_2) * (pl - float2(x, y));
            float s = d.y;
            if (abs(s) > ((0.5 * L) + px))
            {
                continue;
            }
            float across = d.x - (((((0.07999999821186065673828125 * L) * sin((t * 0.89999997615814208984375) + (h.x * 6.0))) * (s / L)) * (s / L)) * 4.0);
            float phase = (_170.uTwist * (((2.5 * s) / L) + (t * 1.2000000476837158203125))) + (h.y * 6.280000209808349609375);
            float ct = cos(phase);
            float halfW = (0.5 * _170.uWidth) * fast::max(abs(ct), 0.039999999105930328369140625);
            float cover = smoothstep(halfW + (px / sc), halfW - (px / sc), abs(across)) * smoothstep((0.5 * L) + px, (0.5 * L) - px, abs(s));
            if (cover <= 0.0)
            {
                continue;
            }
            if (h.z < 0.5)
            {
                _485 = _170.uPaper;
            }
            else
            {
                _485 = _170.uPaper2;
            }
            float3 paper = _485;
            float front = step(0.0, ct);
            float u = across / fast::max(halfW, 9.9999997473787516355514526367188e-05);
            float row = floor((s / 0.010999999940395355224609375) + (h.w * 10.0));
            float2 param_3 = float2(row, floor((u * 1.5) + (h.x * 3.0)) + (c * 3.0));
            float word = step(0.3499999940395355224609375, hash12(param_3));
            float ink = (((front * _170.uLines) * word) * step(0.550000011920928955078125, fract((s / 0.010999999940395355224609375) + (h.w * 10.0)))) * step(abs(u), 0.85000002384185791015625);
            float3 colour = mix(paper * mix(0.819999992847442626953125, 1.0, front), float3(_170.uInk), float3(ink * 0.550000011920928955078125));
            colour *= (0.60000002384185791015625 + (0.4000000059604644775390625 * abs(ct)));
            colour += float3(0.119999997317790985107421875 * powr(1.0 - abs(ct), 4.0));
            float4 param_4 = acc;
            float3 param_5 = colour * (1.0 - (0.100000001490116119384765625 * float(l)));
            float param_6 = cover;
            acc = over(param_4, param_5, param_6);
        }
    }
    float4 param_7 = acc;
    fragColor = unpremultiply(param_7);
}

fragment flair_paper_shreds_frag_out flair_paper_shreds_frag(constant FlairUniforms& _170 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_paper_shreds_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _616;
    if (_170.flair_flipY > 0.5)
    {
        _616 = _170.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _616 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _616);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _170);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

