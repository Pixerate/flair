// flair-metal-hash: b2e7ccce
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
    packed_float3 uTint;
    float uDrain;
    float uRain;
    float uAngle;
    float uPush;
    float uPushTime;
    float uVignette;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_sad_mode_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _95)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_95.uBackdrop) * _95.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_95.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _95)
{
    float4 _237;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _237 = overBackdrop(param, _95);
    }
    else
    {
        float2 param_1 = fract(uv);
        _237 = float4(testCard(param_1), 1.0);
    }
    return _237;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float rain(thread const float2& p, thread const float& n, thread const float& len, thread const float& speed, thread const float& seed, constant FlairUniforms& _95)
{
    float c = floor(p.x * n);
    float2 param = float2(c, seed);
    float h = hash12(param);
    float y = fract(((p.y * 0.5) + ((_95.iTime * speed) * (0.800000011920928955078125 + (0.4000000059604644775390625 * h)))) + (h * 7.0));
    float x = abs((fract(p.x * n) - 0.5) - ((h - 0.5) * 0.60000002384185791015625));
    float streak = smoothstep(0.0, len * 0.300000011920928955078125, y) * smoothstep(len, len * 0.4000000059604644775390625, y);
    return (step(0.3499999940395355224609375, h) * streak) * smoothstep(0.07999999821186065673828125, 0.0, x);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _95, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_95.iResolution[0], _95.iResolution[1]);
    float aspect = _95.iResolution[0u] / _95.iResolution[1u];
    float cycle = (_95.uPushTime + 2.0) + 1.2000000476837158203125;
    float t = mod(_95.iTime, cycle);
    float pulled = smoothstep(0.0, _95.uPushTime, t) - smoothstep(cycle - 1.2000000476837158203125, cycle, t);
    float2 param = float2(0.5) + ((uv - float2(0.5)) / float2(1.0 + (_95.uPush * (1.0 - pulled))));
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _95);
    float3 col = pic.xyz;
    float l = dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 cool = float3(_95.uTint) * (l / fast::max(dot(float3(_95.uTint), float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), 0.0500000007450580596923828125));
    col = mix(col, mix(float3(l), cool, float3(0.75)), float3(_95.uDrain));
    col = mix(col, (col * 0.819999992847442626953125) + (float3(_95.uTint) * 0.0599999986588954925537109375), float3(_95.uDrain));
    float2 p = uv * float2(aspect, 1.0);
    float ang = radians(_95.uAngle);
    p = float2x2(float2(cos(ang), -sin(ang)), float2(sin(ang), cos(ang))) * p;
    float2 param_1 = p;
    float param_2 = 26.0;
    float param_3 = 0.3499999940395355224609375;
    float param_4 = 1.60000002384185791015625;
    float param_5 = 1.0;
    float2 param_6 = p + float2(0.37000000476837158203125);
    float param_7 = 55.0;
    float param_8 = 0.20000000298023223876953125;
    float param_9 = 1.10000002384185791015625;
    float param_10 = 2.0;
    float drops = rain(param_1, param_2, param_3, param_4, param_5, _95) + (rain(param_6, param_7, param_8, param_9, param_10, _95) * 0.5);
    col += (((float3(0.7799999713897705078125, 0.839999973773956298828125, 0.949999988079071044921875) * drops) * _95.uRain) * 0.3499999940395355224609375);
    float r = length((uv - float2(0.5)) * float2(aspect, 1.0));
    col *= (1.0 - ((_95.uVignette * 0.85000002384185791015625) * smoothstep(0.20000000298023223876953125, 0.949999988079071044921875, r)));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
}

fragment flair_sad_mode_frag_out flair_sad_mode_frag(constant FlairUniforms& _95 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_sad_mode_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _528;
    if (_95.flair_flipY > 0.5)
    {
        _528 = _95.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _528 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _528);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _95, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

