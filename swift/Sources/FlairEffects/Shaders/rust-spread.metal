// flair-metal-hash: 28094fee
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
    float3 uRust;
    float3 uRustLight;
    packed_float3 uDeep;
    float uSeeds;
    float uRough;
    float uReach;
    float uCycle;
    uint uAnimate;
    float uProgress;
    char _m22_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_rust_spread_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _236)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_236.uBackdrop) * _236.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_236.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _236)
{
    float4 _373;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _373 = overBackdrop(param, _236);
    }
    else
    {
        float2 param_1 = fract(uv);
        _373 = float4(testCard(param_1), 1.0);
    }
    return _373;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _236, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_236.iResolution[0], _236.iResolution[1]);
    float aspect = _236.iResolution[0u] / _236.iResolution[1u];
    float2 p = (fragCoord - (float2(_236.iResolution[0], _236.iResolution[1]) * 0.5)) / float2(_236.iResolution[1u]);
    float u = fract(_236.iTime / _236.uCycle);
    float _430;
    if (_236.uAnimate != 0u)
    {
        _430 = smoothstep(0.0, 0.800000011920928955078125, u);
    }
    else
    {
        _430 = _236.uProgress;
    }
    float k = _430;
    float _444;
    if (_236.uAnimate != 0u)
    {
        _444 = smoothstep(0.87999999523162841796875, 1.0, u);
    }
    else
    {
        _444 = 0.0;
    }
    float back = _444;
    float seed = 100000.0;
    int n = int(_236.uSeeds + 0.5);
    for (int i = 0; i < 6; i++)
    {
        if (i >= n)
        {
            break;
        }
        float2 param = float2(float(i) * 3.099999904632568359375, 7.69999980926513671875);
        float2 s = (hash22(param) - float2(0.5)) * float2(aspect * 0.85000002384185791015625, 0.85000002384185791015625);
        seed = fast::min(seed, length(p - s));
    }
    float2 param_1 = p * 4.0;
    int param_2 = 5;
    float _507 = fbm(param_1, param_2);
    float field = seed + (((_507 - 0.5) * 0.4000000059604644775390625) * _236.uRough);
    float front = k * _236.uReach;
    float rust = smoothstep(front, front - 0.0199999995529651641845703125, field) * step(0.001000000047497451305389404296875, k);
    float depth = fast::clamp((front - field) / 0.300000011920928955078125, 0.0, 1.0);
    float stain = exp((-abs(field - front)) / 0.01200000010430812835693359375) * step(0.001000000047497451305389404296875, k);
    float2 param_3 = p * 18.0;
    int param_4 = 4;
    float _559 = fbm(param_3, param_4);
    float grain = _559;
    float2 param_5 = (p * 40.0) + float2(3.0);
    int param_6 = 3;
    float _568 = fbm(param_5, param_6);
    float pits = smoothstep(0.60000002384185791015625, 0.699999988079071044921875, _568) * (0.300000011920928955078125 + (0.699999988079071044921875 * depth));
    float3 rc = mix(_236.uRust, _236.uRustLight, float3(smoothstep(0.3499999940395355224609375, 0.75, grain)));
    rc = mix(rc, float3(_236.uDeep), float3(fast::clamp(pits + ((0.300000011920928955078125 * depth) * (1.0 - grain)), 0.0, 1.0)));
    float2 param_7 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_7, _236);
    float l = dot(pic.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 col = mix(pic.xyz, rc * (0.699999988079071044921875 + ((0.5 * l) * (1.0 - depth))), float3(rust * mix(0.75, 1.0, depth)));
    col = mix(col, float3(_236.uDeep), float3((stain * 0.550000011920928955078125) * (1.0 - (rust * 0.5))));
    col = mix(col, pic.xyz, float3(back));
    fragColor = float4(col, pic.w);
}

fragment flair_rust_spread_frag_out flair_rust_spread_frag(constant FlairUniforms& _236 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_rust_spread_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _667;
    if (_236.flair_flipY > 0.5)
    {
        _667 = _236.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _667 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _667);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _236, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

