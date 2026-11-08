// flair-metal-hash: b566d54a
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float uThreshold;
    float uKnee;
    float uRadius;
    float uIntensity;
    packed_float3 uTint;
    float uStreak;
    packed_float3 uStreakColor;
    float uStreakAngle;
    float uStreakLength;
    char _m22_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_bloom_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float3 bright(thread const float2& uv, thread const float& lod, constant FlairUniforms& _64, texture2d<float> uImage, sampler uImageSmplr)
{
    float3 _235;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _235 = uImage.sample(uImageSmplr, uv, level(lod)).xyz;
    }
    else
    {
        float2 param = fract(uv);
        _235 = testCard(param);
    }
    float3 c = _235;
    float l = dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float thr = _64.uThreshold * exp2((-fast::max(lod, 0.0)) * 0.100000001490116119384765625);
    float knee = _64.uKnee * exp2((-fast::max(lod, 0.0)) * 0.100000001490116119384765625);
    float k = fast::clamp(((l - thr) + knee) / (2.0 * knee), 0.0, 1.0);
    float _293;
    if (l > thr)
    {
        _293 = l - thr;
    }
    else
    {
        _293 = ((k * k) * knee) * 0.5;
    }
    float soft = _293;
    return (c * fast::max(soft, 0.0)) / float3(fast::max(l, 9.9999997473787516355514526367188e-05));
}

static inline __attribute__((always_inline))
float3 blurBright(thread const float2& uv, thread const float& r, thread const float& texels, constant FlairUniforms& _64, texture2d<float> uImage, sampler uImageSmplr)
{
    float lod = log2(fast::max((r * 0.4000000059604644775390625) * texels, 1.0));
    float3 sum = float3(0.0);
    float2 aspect = float2(_64.iResolution[1u] / _64.iResolution[0u], 1.0);
    for (int i = 0; i < 20; i++)
    {
        float rr = r * sqrt((float(i) + 0.5) / 20.0);
        float a = float(i) * 2.399960041046142578125;
        float2 param = uv + ((float2(cos(a), sin(a)) * rr) * aspect);
        float param_1 = lod;
        sum += bright(param, param_1, _64, uImage, uImageSmplr);
    }
    return sum / float3(20.0);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _64)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_64.uBackdrop) * _64.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_64.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
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
    float _394;
    if (int2(uImage.get_width(), uImage.get_height()).y > 1)
    {
        _394 = float(int2(uImage.get_width(), uImage.get_height()).y);
    }
    else
    {
        _394 = _64.iResolution[1u];
    }
    float texels = _394;
    float2 param = uv;
    float param_1 = _64.uRadius * 0.300000011920928955078125;
    float param_2 = texels;
    float2 param_3 = uv;
    float param_4 = _64.uRadius;
    float param_5 = texels;
    float2 param_6 = uv;
    float param_7 = _64.uRadius * 3.0;
    float param_8 = texels;
    float3 light = ((blurBright(param, param_1, param_2, _64, uImage, uImageSmplr) * 0.300000011920928955078125) + (blurBright(param_3, param_4, param_5, _64, uImage, uImageSmplr) * 0.4000000059604644775390625)) + (blurBright(param_6, param_7, param_8, _64, uImage, uImageSmplr) * 0.5);
    light *= float3(_64.uTint);
    if (_64.uStreak > 0.0)
    {
        float a = radians(_64.uStreakAngle);
        float2 along = float2(cos(a), (sin(a) * _64.iResolution[0u]) / _64.iResolution[1u]) * _64.uStreakLength;
        float3 streak = float3(0.0);
        float w = 0.0;
        float jitter = fract(sin(dot(fragCoord, float2(12.98980045318603515625, 78.233001708984375))) * 43758.546875) - 0.5;
        float _491;
        if (int2(uImage.get_width(), uImage.get_height()).x > 1)
        {
            _491 = float(int2(uImage.get_width(), uImage.get_height()).x);
        }
        else
        {
            _491 = _64.iResolution[0u];
        }
        float texelsX = _491;
        float lodStreak = log2(fast::max(0.012500000186264514923095703125 * texelsX, 1.0));
        for (int i = -24; i <= 24; i++)
        {
            float f = (float(i) + jitter) / 24.0;
            float k = exp((-abs(f)) * 3.5);
            float2 param_9 = uv + (along * f);
            float param_10 = lodStreak;
            streak += (bright(param_9, param_10, _64, uImage, uImageSmplr) * k);
            w += k;
        }
        light += (((float3(_64.uStreakColor) * dot(streak / float3(w), float3(0.3300000131130218505859375))) * _64.uStreak) * 4.0);
    }
    light *= _64.uIntensity;
    float2 param_11 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_11, _64);
    float glowA = fast::clamp(fast::max(light.x, fast::max(light.y, light.z)), 0.0, 1.0);
    float alpha = fast::max(pic.w, glowA);
    float3 col = ((pic.xyz * pic.w) + light) / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05));
    fragColor = float4(col, alpha);
}

fragment flair_bloom_frag_out flair_bloom_frag(constant FlairUniforms& _64 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_bloom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _624;
    if (_64.flair_flipY > 0.5)
    {
        _624 = _64.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _624 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _624);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _64, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

