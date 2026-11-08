// flair-metal-hash: 988b77f8
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

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    float3 uSkyTop;
    float3 uSkyHorizon;
    packed_float3 uGround;
    float uPoleX;
    float uPoleY;
    float uArc;
    float uSpeed;
    float uDensity;
    float uWidth;
    float uColour;
    float uFade;
    float uHorizon;
};

struct flair_star_trails_frag_out
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
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float skyline(thread const float& x, thread const float& horizon, thread const float& trees)
{
    float2 param = float2(x * 2.2000000476837158203125, 3.099999904632568359375);
    int param_1 = 4;
    float _221 = fbm(param, param_1);
    float hill = horizon * (0.75 + (0.5 * _221));
    float y = hill;
    float cell = 0.0280000008642673492431640625;
    float c = floor(x / cell);
    for (int k = -1; k <= 1; k++)
    {
        float id = c + float(k);
        float2 param_2 = float2(id, 4.400000095367431640625);
        float2 h = hash22(param_2);
        if (h.x < (1.0 - (0.550000011920928955078125 * trees)))
        {
            continue;
        }
        float cx = ((id + 0.5) * cell) + (((h.y - 0.5) * cell) * 0.60000002384185791015625);
        float height = (horizon * (0.180000007152557373046875 + (0.300000011920928955078125 * h.y))) + 0.00999999977648258209228515625;
        y = fast::max(y, (hill + height) - (abs(x - cx) / 0.23999999463558197021484375));
    }
    return y;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _313)
{
    float px = 1.0 / _313.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _313.iResolution[0u] * px;
    float3 col = mix(_313.uSkyHorizon, _313.uSkyTop, float3(smoothstep(_313.uHorizon, 1.0, p.y)));
    float2 q = (p - float2(_313.uPoleX * aspect, _313.uPoleY)) / float2(px);
    float r = length(q);
    float ang = precise::atan2(q.y, q.x);
    float ringW = 2.599999904632568359375;
    float ring = floor(r / ringW);
    float arc = radians(_313.uArc);
    float turn = radians(_313.uSpeed) * _313.iTime;
    float _509;
    for (int k = -1; k <= 1; k++)
    {
        float id = ring + float(k);
        if (id < 0.0)
        {
            continue;
        }
        for (int j = 0; j < 2; j++)
        {
            float2 param = float2(id, (float(j) * 17.0) + 3.0);
            float2 h = hash22(param);
            if (h.x > _313.uDensity)
            {
                continue;
            }
            float2 param_1 = float2(id * 1.2999999523162841796875, float(j) + 9.0);
            float g = hash12(param_1);
            float rs = ((id + 0.20000000298023223876953125) + (0.60000002384185791015625 * (h.x / _313.uDensity))) * ringW;
            float bright = 0.119999997317790985107421875 + (0.89999997615814208984375 * powr(g, 4.0));
            float w = _313.uWidth * (0.60000002384185791015625 + (0.800000011920928955078125 * bright));
            float dr = r - rs;
            float line = exp((-(dr * dr)) / ((w * w) * 0.5));
            float behind = mod((turn + (h.y * 6.28318023681640625)) - ang, 6.28318023681640625);
            float past = ((behind - arc) * rs) / w;
            if (behind < arc)
            {
                _509 = 1.0 - ((_313.uFade * behind) / fast::max(arc, 0.001000000047497451305389404296875));
            }
            else
            {
                _509 = (1.0 - _313.uFade) * exp((-past) * past);
            }
            float on = _509;
            float ahead = ((6.28318023681640625 - behind) * rs) / w;
            on = fast::max(on, exp((-ahead) * ahead));
            float2 param_2 = float2(id, float(j) + 5.0);
            float3 tint = mix(float3(1.0), mix(float3(0.60000002384185791015625, 0.75, 1.0), float3(1.0, 0.7200000286102294921875, 0.449999988079071044921875), float3(hash12(param_2))), float3(_313.uColour));
            col += (((tint * bright) * line) * on);
        }
    }
    if (_313.uHorizon > 0.0)
    {
        float param_3 = p.x;
        float param_4 = _313.uHorizon;
        float param_5 = 1.0;
        col = mix(col, float3(_313.uGround), float3(smoothstep(-px, px, skyline(param_3, param_4, param_5) - p.y)));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_star_trails_frag_out flair_star_trails_frag(constant FlairUniforms& _313 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_star_trails_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _624;
    if (_313.flair_flipY > 0.5)
    {
        _624 = _313.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _624 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _624);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _313);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

