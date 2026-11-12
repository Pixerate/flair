// flair-metal-hash: 9629be2b
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
    float3 uTint;
    packed_float3 uShade;
    float uIntensity;
    float uAmbient;
    float uScale;
    float uSpeed;
    float uSharpness;
    float uStretch;
    char _m21_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_pool_caustics_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float causticWeb(thread const float2& q, thread const float& t, thread const float& width)
{
    float2 cell = floor(q);
    float2 f = fract(q);
    float f1 = 8.0;
    float f2 = 8.0;
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 o = float2(float(i), float(j));
            float2 param = cell + o;
            float2 h = hash22(param);
            float2 pt = (o + float2(0.5)) + (sin(float2(t) + (h * 6.28318023681640625)) * 0.4000000059604644775390625);
            float d = length(pt - f);
            if (d < f1)
            {
                f2 = f1;
                f1 = d;
            }
            else
            {
                if (d < f2)
                {
                    f2 = d;
                }
            }
        }
    }
    return 1.0 - smoothstep(0.0, width, f2 - f1);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _70)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_70.uBackdrop) * _70.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_70.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _70)
{
    float4 _214;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _214 = overBackdrop(param, _70);
    }
    else
    {
        float2 param_1 = fract(uv);
        _214 = float4(testCard(param_1), 1.0);
    }
    return _214;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _70, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_70.iResolution[0], _70.iResolution[1]);
    float2 p = (fragCoord - (float2(_70.iResolution[0], _70.iResolution[1]) * 0.5)) / float2(_70.iResolution[1u]);
    float t = _70.iTime * _70.uSpeed;
    float2 q = ((p * float2(1.0, 1.0 - (0.5 * _70.uStretch))) * 5.0) / float2(_70.uScale);
    float2 param = (q * 0.60000002384185791015625) + float2(t * 0.4000000059604644775390625);
    float2 param_1 = ((q * 0.60000002384185791015625) - float2(t * 0.3499999940395355224609375)) + float2(5.0);
    q += (float2(vnoise(param), vnoise(param_1)) * 0.3499999940395355224609375);
    float width = mix(0.3499999940395355224609375, 0.07999999821186065673828125, _70.uSharpness);
    float2 param_2 = q;
    float param_3 = t;
    float param_4 = width;
    float2 param_5 = (q * 1.37000000476837158203125) + float2(7.30000019073486328125);
    float param_6 = t * 1.2999999523162841796875;
    float param_7 = width;
    float web = (causticWeb(param_2, param_3, param_4) * 0.60000002384185791015625) + (causticWeb(param_5, param_6, param_7) * 0.60000002384185791015625);
    web = powr(web, mix(1.0, 2.2000000476837158203125, _70.uSharpness));
    float2 param_8 = (p * 2.0) + float2(t * 0.1500000059604644775390625, (-t) * 0.100000001490116119384765625);
    web *= (0.60000002384185791015625 + (0.60000002384185791015625 * vnoise(param_8)));
    float2 param_9 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_9, _70);
    float3 ambient = mix(float3(1.0), float3(_70.uShade) * 1.7000000476837158203125, float3(0.60000002384185791015625)) * _70.uAmbient;
    float3 col = (pic.xyz * (ambient + ((_70.uTint * web) * _70.uIntensity))) + (((_70.uTint * web) * _70.uIntensity) * 0.0599999986588954925537109375);
    fragColor = float4(col / (float3(1.0) + fast::max(col - float3(1.0), float3(0.0))), pic.w);
}

fragment flair_pool_caustics_frag_out flair_pool_caustics_frag(constant FlairUniforms& _70 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_pool_caustics_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _613;
    if (_70.flair_flipY > 0.5)
    {
        _613 = _70.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _613 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _613);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _70, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

