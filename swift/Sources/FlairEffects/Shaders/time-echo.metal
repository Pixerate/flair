// flair-metal-hash: b06e5e75
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
    int uEchoes;
    float uSpacing;
    float uDecay;
    float uMotion;
    packed_float3 uTint;
    float uTintAmount;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_time_echo_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 coverOf(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _64)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _64.iResolution[0u] / _64.iResolution[1u];
    float _243;
    if (size.x > 1.0)
    {
        _243 = size.x / size.y;
    }
    else
    {
        _243 = frameAspect;
    }
    float imageAspect = _243;
    float2 _257;
    if (frameAspect > imageAspect)
    {
        _257 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _257 = float2(frameAspect / imageAspect, 1.0);
    }
    return _257;
}

static inline __attribute__((always_inline))
float2 swayUv(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& t, thread const float& amount, constant FlairUniforms& _64)
{
    float2 cover = coverOf(tex, texSmplr, _64);
    float aspect = _64.iResolution[0u] / _64.iResolution[1u];
    float w = 0.785398006439208984375;
    float zoom = 1.2999999523162841796875 + ((0.180000007152557373046875 * amount) * sin((w * t) + 0.699999988079071044921875));
    float angle = (0.070000000298023223876953125 * amount) * sin(((2.0 * w) * t) + 0.4000000059604644775390625);
    float2 pan = float2((0.100000001490116119384765625 * sin(w * t)) + (0.039999999105930328369140625 * sin(((3.0 * w) * t) + 1.2999999523162841796875)), 0.070000000298023223876953125 * sin(((2.0 * w) * t) + 2.099999904632568359375)) * amount;
    float2 p = (uv - float2(0.5)) * float2(aspect, 1.0);
    float c = cos(angle);
    float s = sin(angle);
    p = (float2x2(float2(c, s), float2(-s, c)) * p) / float2(aspect, 1.0);
    return float2(0.5) + (((p / float2(zoom)) + pan) * cover);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _64)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_64.uBackdrop) * _64.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_64.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _64)
{
    float4 _208;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _208 = overBackdrop(param, _64);
    }
    else
    {
        float2 param_1 = fract(uv);
        _208 = float4(testCard(param_1), 1.0);
    }
    return _208;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _64, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_64.iResolution[0], _64.iResolution[1]);
    float2 param = uv;
    float param_1 = _64.iTime;
    float param_2 = _64.uMotion;
    float2 param_3 = swayUv(uImage, uImageSmplr, param, param_1, param_2, _64);
    float4 now = pictureRGBA(uImage, uImageSmplr, param_3, _64);
    float4 sum = float4(now.xyz * now.w, now.w);
    float total = 1.0;
    float weight = 1.0;
    for (int k = 1; k <= 8; k++)
    {
        if (k > _64.uEchoes)
        {
            break;
        }
        weight *= _64.uDecay;
        float age = float(k) / float(_64.uEchoes);
        float2 param_4 = uv;
        float param_5 = _64.iTime - (float(k) * _64.uSpacing);
        float param_6 = _64.uMotion;
        float2 param_7 = swayUv(uImage, uImageSmplr, param_4, param_5, param_6, _64);
        float4 echo = pictureRGBA(uImage, uImageSmplr, param_7, _64);
        float4 _458 = echo;
        float4 _463 = echo;
        float3 _479 = mix(_458.xyz, (float3(_64.uTint) * dot(_463.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875))) * 1.7999999523162841796875, float3(_64.uTintAmount * age));
        echo.x = _479.x;
        echo.y = _479.y;
        echo.z = _479.z;
        sum += (float4(echo.xyz * echo.w, echo.w) * weight);
        total += weight;
    }
    fragColor = float4(sum.xyz / float3(fast::max(sum.w, 9.9999997473787516355514526367188e-05)), sum.w / total);
}

fragment flair_time_echo_frag_out flair_time_echo_frag(constant FlairUniforms& _64 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_time_echo_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _534;
    if (_64.flair_flipY > 0.5)
    {
        _534 = _64.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _534 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _534);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _64, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

