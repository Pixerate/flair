// flair-metal-hash: 4e5b9aa1
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
    float uFry;
    float uBlocks;
    float uGrain;
    float uGlint;
    float3 uGlintColor;
    float2 uGlintA;
    float2 uGlintB;
    float uGlintSize;
    char _m21_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_deep_fried_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _99)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_99.uBackdrop) * _99.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_99.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _99)
{
    float4 _241;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _241 = overBackdrop(param, _99);
    }
    else
    {
        float2 param_1 = fract(uv);
        _241 = float4(testCard(param_1), 1.0);
    }
    return _241;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _99)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _99).xyz;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float glint(thread const float2& p, thread const float2& c, thread const float& size, thread const float& turn)
{
    float2 d = p - c;
    float cs = cos(turn);
    float sn = sin(turn);
    d = float2((cs * d.x) + (sn * d.y), ((-sn) * d.x) + (cs * d.y)) / float2(size);
    float core = exp((-dot(d, d)) * 40.0);
    float streaks = (exp((-abs(d.y)) * 60.0) * exp((-abs(d.x)) * 2.2000000476837158203125)) + (exp((-abs(d.x)) * 60.0) * exp((-abs(d.y)) * 2.2000000476837158203125));
    return core + (0.699999988079071044921875 * streaks);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _99, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_99.iResolution[0], _99.iResolution[1]);
    float2 texel = float2(1.0) / float2(_99.iResolution[0], _99.iResolution[1]);
    float2 block = ((floor(fragCoord / float2(8.0)) * 8.0) + float2(4.0)) / float2(_99.iResolution[0], _99.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _99);
    float2 param_1 = block;
    float3 col = mix(pic.xyz, picture(uImage, uImageSmplr, param_1, _99), float3((_99.uBlocks * _99.uFry) * 0.449999988079071044921875));
    float2 param_2 = uv + (float2(2.0, 0.0) * texel);
    float2 param_3 = uv - (float2(2.0, 0.0) * texel);
    float2 param_4 = uv + (float2(0.0, 2.0) * texel);
    float2 param_5 = uv - (float2(0.0, 2.0) * texel);
    float3 blur = (((picture(uImage, uImageSmplr, param_2, _99) + picture(uImage, uImageSmplr, param_3, _99)) + picture(uImage, uImageSmplr, param_4, _99)) + picture(uImage, uImageSmplr, param_5, _99)) * 0.25;
    col += (((col - blur) * _99.uFry) * 3.0);
    float l = dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    col = mix(float3(l), col, float3(1.0 + (_99.uFry * 2.2000000476837158203125)));
    col = ((col - float3(0.5)) * (1.0 + (_99.uFry * 1.60000002384185791015625))) + float3(0.5);
    col *= mix(float3(1.0), float3(1.17999994754791259765625, 1.0, 0.7200000286102294921875), float3(_99.uFry));
    float levels = mix(48.0, 5.0, _99.uFry);
    col = floor((fast::clamp(col, float3(0.0), float3(1.0)) * levels) + float3(0.5)) / float3(levels);
    float seed = floor(_99.iTime * 12.0);
    float2 param_6 = fragCoord + float2(seed * 17.0);
    col += float3(((hash12(param_6) - 0.5) * _99.uGrain) * 2.0);
    float aspect = _99.iResolution[0u] / _99.iResolution[1u];
    float2 p = uv * float2(aspect, 1.0);
    float size = _99.uGlintSize * (1.0 + (0.119999997317790985107421875 * sin(_99.iTime * 5.0)));
    float2 param_7 = p;
    float2 param_8 = _99.uGlintA * float2(aspect, 1.0);
    float param_9 = size;
    float param_10 = 0.3499999940395355224609375;
    float2 param_11 = p;
    float2 param_12 = _99.uGlintB * float2(aspect, 1.0);
    float param_13 = size;
    float param_14 = -0.3499999940395355224609375;
    float g = glint(param_7, param_8, param_9, param_10) + glint(param_11, param_12, param_13, param_14);
    g *= _99.uGlint;
    col += (((_99.uGlintColor * g) * 1.60000002384185791015625) + ((float3(1.0) * powr(g, 2.0)) * 0.60000002384185791015625));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, fast::clamp(g, 0.0, 1.0)));
}

fragment flair_deep_fried_frag_out flair_deep_fried_frag(constant FlairUniforms& _99 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_deep_fried_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _607;
    if (_99.flair_flipY > 0.5)
    {
        _607 = _99.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _607 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _607);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _99, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

