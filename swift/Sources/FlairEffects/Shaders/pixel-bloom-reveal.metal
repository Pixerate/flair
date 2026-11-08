// flair-metal-hash: d7641aaf
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
    int uCount;
    float uRadius;
    float uSize;
    float uDissolve;
    float uTwist;
    uint uUpright;
    float3 uInner;
    float3 uMiddle;
    packed_float3 uOuter;
    uint uDiagonal;
    float uGlow;
    float uLoop;
    float uHold;
    float uPop;
};

struct flair_pixel_bloom_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float phase(constant FlairUniforms& _326)
{
    return fract(_326.iTime / _326.uLoop);
}

static inline __attribute__((always_inline))
float2 squareState(thread const float& rn, constant FlairUniforms& _326)
{
    float u = phase(_326);
    float build = (1.0 - _326.uHold) * 0.550000011920928955078125;
    float leave = (1.0 - _326.uHold) * 0.449999988079071044921875;
    float inK = fast::clamp((u - ((rn * build) * 0.64999997615814208984375)) / (build * 0.3499999940395355224609375), 0.0, 1.0);
    float outStart = build + _326.uHold;
    float outK = fast::clamp(((u - outStart) - (((1.0 - rn) * leave) * 0.60000002384185791015625)) / (leave * 0.4000000059604644775390625), 0.0, 1.0);
    return float2(inK, outK);
}

static inline __attribute__((always_inline))
float squareSide(thread const float& n, thread const float& rn, constant FlairUniforms& _326)
{
    float param = rn;
    float2 st = squareState(param, _326);
    float pop = 1.0 + (((_326.uPop * 0.60000002384185791015625) * sin(3.141590118408203125 * st.x)) * (1.0 - (st.x * 0.4000000059604644775390625)));
    float _482;
    if (st.x < 1.0)
    {
        _482 = smoothstep(0.0, 1.0, st.x) * pop;
    }
    else
    {
        _482 = 1.0;
    }
    float grow = _482;
    float shrink = 1.0 - smoothstep(0.0, 1.0, st.y);
    return ((_326.uSize * fast::max(1.0 - ((_326.uDissolve * 0.87999999523162841796875) * rn), 0.0)) * grow) * shrink;
}

static inline __attribute__((always_inline))
float squareTurn(thread const float& n, thread const float& a, constant FlairUniforms& _326)
{
    float param = sqrt(n) / sqrt(float(_326.uCount));
    float2 st = squareState(param, _326);
    float spin = ((1.0 - st.x) * (-1.57079994678497314453125)) + (st.y * 1.57079994678497314453125);
    return ((_326.uUpright != 0u) ? 0.0 : a) + spin;
}

static inline __attribute__((always_inline))
float4 phyllo(thread const float2& p, thread const float& count, thread const float& twist, thread const float& maxSide, thread const float& aa, constant FlairUniforms& _326)
{
    float r = length(p);
    float reach = ((maxSide * 0.707199990749359130859375) + aa) + 0.0500000007450580596923828125;
    float lo = fast::max(1.0, floor(fast::max(r - reach, 0.0) * fast::max(r - reach, 0.0)));
    float hi = fast::min(count, ceil((r + reach) * (r + reach)));
    float root = sqrt(fast::max(count, 1.0));
    float theta = precise::atan2(p.y, p.x);
    float4 best = float4(0.0, 0.0, 0.0, 1000.0);
    for (int i = 0; i < 200; i++)
    {
        float n = lo + float(i);
        if (n > hi)
        {
            break;
        }
        float rn = sqrt(n);
        float a = (n * 2.3999631404876708984375) + (twist * rn);
        float dt = abs(mod((a - theta) + 3.1415927410125732421875, 6.283185482025146484375) - 3.1415927410125732421875);
        if (((0.636619985103607177734375 * fast::min(r, rn)) * dt) > reach)
        {
            continue;
        }
        float param = n;
        float param_1 = rn / root;
        float side = squareSide(param, param_1, _326);
        if (side <= 0.0)
        {
            continue;
        }
        float2 d = p - (float2(cos(a), sin(a)) * rn);
        float param_2 = n;
        float param_3 = a;
        float t = squareTurn(param_2, param_3, _326);
        float c = cos(t);
        float s = sin(t);
        d = float2((c * d.x) + (s * d.y), ((-s) * d.x) + (c * d.y));
        float h = side * 0.5;
        float _round = h * 0.2199999988079071044921875;
        float2 q = abs(d) - float2(h - _round);
        float sd = (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - _round;
        float cover = fast::clamp(0.5 - (sd / aa), 0.0, 1.0);
        bool _259 = cover > best.x;
        bool _275;
        if (!_259)
        {
            bool _266 = cover == best.x;
            bool _274;
            if (_266)
            {
                _274 = sd < best.w;
            }
            else
            {
                _274 = _266;
            }
            _275 = _274;
        }
        else
        {
            _275 = _259;
        }
        if (_275)
        {
            best = float4(cover, n, rn / root, sd);
        }
    }
    return best;
}

static inline __attribute__((always_inline))
float3 ramp3(thread const float3& a, thread const float3& b, thread const float3& c, thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    float3 _296;
    if (t < 0.550000011920928955078125)
    {
        _296 = mix(a, b, float3(t / 0.550000011920928955078125));
    }
    else
    {
        _296 = mix(b, c, float3((t - 0.550000011920928955078125) / 0.449999988079071044921875));
    }
    return _296;
}

static inline __attribute__((always_inline))
float4 paintBloom(thread const float4& hit, thread const float2& p, thread const float& bloomR, constant FlairUniforms& _326)
{
    float _332;
    if (_326.uDiagonal != 0u)
    {
        _332 = fast::clamp(0.5 + dot(p / float2(bloomR), float2(0.5, -0.5)), 0.0, 1.0);
    }
    else
    {
        _332 = hit.z;
    }
    float t = _332;
    float3 param = _326.uInner;
    float3 param_1 = _326.uMiddle;
    float3 param_2 = float3(_326.uOuter);
    float param_3 = t;
    float3 _365 = ramp3(param, param_1, param_2, param_3);
    float3 col = _365;
    float glowA = ((_326.uGlow * 0.550000011920928955078125) * exp((-fast::max(hit.w, 0.0)) / 0.3499999940395355224609375)) * step(0.5, hit.y);
    float alpha = fast::max(hit.x, glowA);
    return float4(col, alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _326)
{
    float2 p = (fragCoord - (float2(_326.iResolution[0], _326.iResolution[1]) * 0.5)) / float2(_326.iResolution[1u]);
    float count = float(_326.uCount);
    float spacing = _326.uRadius / sqrt(count);
    float2 q = p / float2(spacing);
    float2 param = q;
    float param_1 = count;
    float param_2 = _326.uTwist * 0.60000002384185791015625;
    float param_3 = _326.uSize * (1.0 + (_326.uPop * 0.60000002384185791015625));
    float param_4 = 1.2000000476837158203125 / (_326.iResolution[1u] * spacing);
    float4 hit = phyllo(param, param_1, param_2, param_3, param_4, _326);
    float4 param_5 = hit;
    float2 param_6 = q;
    float param_7 = sqrt(count);
    fragColor = paintBloom(param_5, param_6, param_7, _326);
}

fragment flair_pixel_bloom_reveal_frag_out flair_pixel_bloom_reveal_frag(constant FlairUniforms& _326 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_bloom_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _622;
    if (_326.flair_flipY > 0.5)
    {
        _622 = _326.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _622 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _622);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _326);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

