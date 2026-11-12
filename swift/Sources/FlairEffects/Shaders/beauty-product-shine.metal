// flair-metal-hash: 0dcfad3a
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    packed_float3 uGlint;
    float uStrength;
    float uWidth;
    float uAngle;
    int uSparkles;
    float uSparkleSize;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_beauty_product_shine_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _91)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_91.uBackdrop) * _91.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_91.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _91)
{
    float4 _235;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _235 = overBackdrop(param, _91);
    }
    else
    {
        float2 param_1 = fract(uv);
        _235 = float4(testCard(param_1), 1.0);
    }
    return _235;
}

static inline __attribute__((always_inline))
float product(thread const float2& uv, texture2d<float> uImage, sampler uImageSmplr)
{
    float _261;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _261 = uImage.sample(uImageSmplr, uv).w;
    }
    else
    {
        _261 = 1.0;
    }
    return _261;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _91, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_91.iResolution[0], _91.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _91);
    float t = fract(_91.iTime / 3.0);
    float a = radians(_91.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float2 p = (fragCoord - (float2(_91.iResolution[0], _91.iResolution[1]) * 0.5)) / float2(_91.iResolution[1u]);
    float span = (0.5 * (((abs(dir.x) * _91.iResolution[0u]) / _91.iResolution[1u]) + abs(dir.y))) + (2.0 * _91.uWidth);
    float d = dot(p, dir) - mix(-span, span, smoothstep(0.0, 0.60000002384185791015625, t));
    float glint = exp(((-d) * d) / (_91.uWidth * _91.uWidth)) + (0.5 * exp(-powr((d + (1.7999999523162841796875 * _91.uWidth)) / (0.3499999940395355224609375 * _91.uWidth), 2.0)));
    float2 param_1 = uv;
    float3 col = pic.xyz + (((float3(1.0) - pic.xyz) * float3(_91.uGlint)) * fast::clamp((glint * product(param_1, uImage, uImageSmplr)) * _91.uStrength, 0.0, 1.0));
    float spark = 0.0;
    float n = fast::max(float(_91.uSparkles), 1.0);
    for (int i = 0; i < 8; i++)
    {
        if (i >= _91.uSparkles)
        {
            break;
        }
        float fi = float(i);
        float life = sin(fast::clamp(((t - 0.1500000059604644775390625) - ((0.699999988079071044921875 * fi) / n)) / 0.25, 0.0, 1.0) * 3.141590118408203125);
        if (life <= 0.0)
        {
            continue;
        }
        float2 c = float2(-1.0);
        for (int j = 0; j < 4; j++)
        {
            float2 param_2 = float2((fi * 7.0) + float(j), 4.19999980926513671875);
            float2 tryAt = float2(0.1500000059604644775390625) + (hash22(param_2) * 0.699999988079071044921875);
            float2 param_3 = tryAt;
            if (product(param_3, uImage, uImageSmplr) > 0.5)
            {
                c = tryAt;
                break;
            }
        }
        if (c.x < 0.0)
        {
            continue;
        }
        float2 q = (fragCoord - (c * float2(_91.iResolution[0], _91.iResolution[1]))) / float2(_91.uSparkleSize * life);
        float arms = (fast::max(0.0, 1.0 - (abs(q.x) * 8.0)) * fast::max(0.0, 1.0 - abs(q.y))) + (fast::max(0.0, 1.0 - (abs(q.y) * 8.0)) * fast::max(0.0, 1.0 - abs(q.x)));
        spark += (((arms * arms) + exp((-dot(q, q)) * 30.0)) * life);
    }
    spark = fast::clamp(spark, 0.0, 1.0);
    fragColor = float4(mix(col, float3(_91.uGlint), float3(spark)), fast::max(pic.w, spark));
}

fragment flair_beauty_product_shine_frag_out flair_beauty_product_shine_frag(constant FlairUniforms& _91 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_beauty_product_shine_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _570;
    if (_91.flair_flipY > 0.5)
    {
        _570 = _91.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _570 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _570);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _91, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

