// flair-metal-hash: 3b82865e
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
    float3 uSkyTop;
    float3 uSkyHorizon;
    float3 uGround;
    packed_float3 uColor;
    int uCount;
    float uSpacing;
    float uSpeed;
    float uSize;
    float uShadow;
    float uFlare;
    uint uStreak;
    float uHorizon;
    float uStars;
};

struct flair_satellite_pass_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float stars(thread const float2& fragCoord, thread const float& density, constant FlairUniforms& _270)
{
    float2 cell = floor(fragCoord / float2(3.0));
    float2 param = cell;
    float h = hash12(param);
    float on = step(1.0 - (0.01200000010430812835693359375 * density), h);
    float2 param_1 = cell;
    float2 at = hash22(param_1) * 3.0;
    float d = length((fract(fragCoord / float2(3.0)) * 3.0) - at);
    float2 param_2 = cell + float2(7.0);
    return ((on * smoothstep(1.39999997615814208984375, 0.0, d)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_2)))) * (0.75 + (0.25 * sin((_270.iTime * (1.0 + (3.0 * h))) + (h * 40.0))));
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
    float _298 = fbm(param, param_1);
    float hill = horizon * (0.75 + (0.5 * _298));
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _270)
{
    float px = 1.0 / _270.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _270.iResolution[0u] * px;
    float2 param = fragCoord;
    float param_1 = 1.0;
    float3 col = mix(_270.uSkyHorizon, _270.uSkyTop, float3(smoothstep(_270.uHorizon, 1.0, p.y))) + float3(stars(param, param_1, _270) * _270.uStars);
    float span = aspect + 0.4000000059604644775390625;
    float period = ((span + (float(_270.uCount - 1) * _270.uSpacing)) / _270.uSpeed) + 2.0;
    float pass = floor(_270.iTime / period);
    float t = _270.iTime - (pass * period);
    float2 param_2 = float2(pass, 3.2999999523162841796875);
    float2 param_3 = float2(pass, 7.69999980926513671875);
    float3 h = float3(hash22(param_2), hash12(param_3));
    float y0 = (_270.uHorizon + 0.20000000298023223876953125) + (0.60000002384185791015625 * h.x);
    float y1 = (_270.uHorizon + 0.20000000298023223876953125) + (0.60000002384185791015625 * h.y);
    float flip = (h.z < 0.5) ? 1.0 : (-1.0);
    float bow = 0.119999997317790985107421875 * (h.x - 0.300000011920928955078125);
    float3 light = float3(0.0);
    float _586;
    float _660;
    for (int i = 0; i < 24; i++)
    {
        if (i >= _270.uCount)
        {
            break;
        }
        float s = ((t * _270.uSpeed) - (float(i) * _270.uSpacing)) / span;
        if ((s < 0.0) || (s > 1.0))
        {
            continue;
        }
        float bright = smoothstep(0.0, 0.25, s) * (1.0 - smoothstep(_270.uShadow - 0.07999999821186065673828125, _270.uShadow, s));
        float glint = (s - 0.5) * 22.0;
        float2 param_4 = float2(pass, float(i));
        bright *= (1.0 + (((6.0 * _270.uFlare) * exp((-glint) * glint)) * step(0.5, hash12(param_4) + (_270.uFlare * 0.5))));
        if (flip > 0.0)
        {
            _586 = s;
        }
        else
        {
            _586 = 1.0 - s;
        }
        float x = mix(-0.20000000298023223876953125, aspect + 0.20000000298023223876953125, _586);
        float2 at = float2(x, mix(y0, y1, s) + (bow * sin(s * 3.141590118408203125)));
        float r = length(p - at) / px;
        light += ((float3(_270.uColor) * bright) * ((exp((-(r * r)) / (_270.uSize * _270.uSize)) * 1.60000002384185791015625) + (0.25 * exp((-r) / (_270.uSize * 3.0)))));
        if ((_270.uStreak != 0u) && (i == 0))
        {
            if (flip > 0.0)
            {
                _660 = p.x + 0.20000000298023223876953125;
            }
            else
            {
                _660 = (aspect + 0.20000000298023223876953125) - p.x;
            }
            float sx = _660 / (aspect + 0.4000000059604644775390625);
            if ((sx > 0.0) && (sx < s))
            {
                float py = mix(y0, y1, sx) + (bow * sin(sx * 3.141590118408203125));
                float slope = ((y1 - y0) + ((bow * 3.141590118408203125) * cos(sx * 3.141590118408203125))) / (aspect + 0.4000000059604644775390625);
                float d = (abs(p.y - py) / sqrt(1.0 + (slope * slope))) / px;
                float b = smoothstep(0.0, 0.25, sx) * (1.0 - smoothstep(_270.uShadow - 0.07999999821186065673828125, _270.uShadow, sx));
                light += (((float3(_270.uColor) * b) * 0.699999988079071044921875) * exp((-(d * d)) / ((_270.uSize * _270.uSize) * 0.5)));
            }
        }
    }
    col += light;
    if (_270.uHorizon > 0.0)
    {
        float param_5 = p.x;
        float param_6 = _270.uHorizon;
        float param_7 = 0.60000002384185791015625;
        col = mix(col, _270.uGround, float3(smoothstep(-px, px, skyline(param_5, param_6, param_7) - p.y)));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_satellite_pass_frag_out flair_satellite_pass_frag(constant FlairUniforms& _270 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_satellite_pass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _804;
    if (_270.flair_flipY > 0.5)
    {
        _804 = _270.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _804 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _804);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _270);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

