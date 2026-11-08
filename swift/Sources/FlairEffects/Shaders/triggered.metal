// flair-metal-hash: f01c61b9
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
    packed_float3 uTint;
    float uRed;
    float uShake;
    float uRate;
    float3 uBar;
    packed_float3 uInk;
    float uBarHeight;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_triggered_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _159)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_159.uBackdrop) * _159.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_159.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _159)
{
    float4 _300;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _300 = overBackdrop(param, _159);
    }
    else
    {
        float2 param_1 = fract(uv);
        _300 = float4(testCard(param_1), 1.0);
    }
    return _300;
}

static inline __attribute__((always_inline))
float4 inkBox(texture2d<float> uText, sampler uTextSmplr)
{
    float x0 = 1.0;
    float x1 = 0.0;
    for (int i = 0; i < 32; i++)
    {
        float u = (float(i) + 0.5) / 32.0;
        if (uText.sample(uTextSmplr, float2(u, 0.5), level(4.0)).w > 0.039999999105930328369140625)
        {
            x0 = u;
            break;
        }
    }
    for (int i_1 = 31; i_1 >= 0; i_1--)
    {
        float u_1 = (float(i_1) + 0.5) / 32.0;
        if (uText.sample(uTextSmplr, float2(u_1, 0.5), level(4.0)).w > 0.039999999105930328369140625)
        {
            x1 = u_1;
            break;
        }
    }
    if (x1 < x0)
    {
        return float4(0.0);
    }
    float y0 = 1.0;
    float y1 = 0.0;
    for (int j = 31; j >= 0; j--)
    {
        float v = (float(j) + 0.5) / 32.0;
        float a = 0.0;
        for (int k = 0; k < 3; k++)
        {
            a = fast::max(a, uText.sample(uTextSmplr, float2(mix(x0, x1, (float(k) + 0.5) / 3.0), v), level(3.0)).w);
        }
        if (a > 0.20000000298023223876953125)
        {
            y1 = v;
            break;
        }
    }
    for (int j_1 = 0; j_1 < 32; j_1++)
    {
        float v_1 = (float(j_1) + 0.5) / 32.0;
        float a_1 = 0.0;
        for (int k_1 = 0; k_1 < 3; k_1++)
        {
            a_1 = fast::max(a_1, uText.sample(uTextSmplr, float2(mix(x0, x1, (float(k_1) + 0.5) / 3.0), v_1), level(3.0)).w);
        }
        if (a_1 > 0.20000000298023223876953125)
        {
            y0 = v_1;
            break;
        }
    }
    float4 _507;
    if (y1 > y0)
    {
        _507 = float4(x0, x1, y0, y1);
    }
    else
    {
        _507 = float4(0.0);
    }
    return _507;
}

static inline __attribute__((always_inline))
float2 inkUV(thread const float2& p, thread const float4& ink, thread const float& h, thread const float& maxW, texture2d<float> uText, sampler uTextSmplr)
{
    float2 tsize = float2(int2(uText.get_width(), uText.get_height()));
    float th = h / fast::max(ink.w - ink.z, 0.001000000047497451305389404296875);
    float tw = (th * tsize.x) / fast::max(tsize.y, 1.0);
    float inkW = (ink.y - ink.x) * tw;
    float _555;
    if (inkW > maxW)
    {
        _555 = maxW / inkW;
    }
    else
    {
        _555 = 1.0;
    }
    float fit = _555;
    return float2(((ink.x + ink.y) * 0.5) + (p.x / (tw * fit)), ((ink.z + ink.w) * 0.5) + (p.y / (th * fit)));
}

static inline __attribute__((always_inline))
float words(thread const float2& tuv, texture2d<float> uText, sampler uTextSmplr)
{
    float a = uText.sample(uTextSmplr, fast::clamp(tuv, float2(0.0), float2(1.0))).w;
    bool _333 = all(tuv >= float2(0.0));
    bool _339;
    if (_333)
    {
        _339 = all(tuv <= float2(1.0));
    }
    else
    {
        _339 = _333;
    }
    return _339 ? a : 0.0;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _159, texture2d<float> uText, sampler uTextSmplr, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_159.iResolution[0], _159.iResolution[1]);
    float aspect = _159.iResolution[0u] / _159.iResolution[1u];
    float s = floor(_159.iTime * _159.uRate) * 2.2999999523162841796875;
    float2 param = float2(s, 1.0);
    float2 param_1 = float2(s + 17.0, 5.0);
    float2 jitter = (float2(vnoise(param), vnoise(param_1)) * 2.0) - float2(1.0);
    float2 param_2 = float2((s * 0.800000011920928955078125) + 41.0, 3.0);
    float twist = (vnoise(param_2) * 2.0) - 1.0;
    float amount = fast::clamp(_159.uShake, 0.0, 1.0);
    float2 q = (uv - float2(0.5)) * float2(aspect, 1.0);
    float ang = (twist * amount) * 0.0199999995529651641845703125;
    q = float2x2(float2(cos(ang), sin(ang)), float2(-sin(ang), cos(ang))) * q;
    q = (q / float2(1.0 + (0.0500000007450580596923828125 * amount))) + ((jitter * amount) * 0.0199999995529651641845703125);
    float2 param_3 = (q / float2(aspect, 1.0)) + float2(0.5);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_3, _159);
    float3 col = pic.xyz;
    float l = dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    col = mix(col, float3(_159.uTint) * (0.20000000298023223876953125 + (l * 1.2999999523162841796875)), float3(_159.uRed));
    col = ((col - float3(0.5)) * (1.0 + (0.300000011920928955078125 * _159.uRed))) + float3(0.5);
    float2 shift = ((jitter * amount) * 0.0199999995529651641845703125) * 0.5;
    float y = uv.y - shift.y;
    float px = 1.0 / _159.iResolution[1u];
    float bar = smoothstep(_159.uBarHeight + px, _159.uBarHeight - px, y);
    if (bar > 0.0)
    {
        float4 ink = inkBox(uText, uTextSmplr);
        float2 p = float2(((uv.x - 0.5) * aspect) - shift.x, y - (_159.uBarHeight * 0.5));
        float _786;
        if (ink.y > ink.x)
        {
            float2 param_4 = p;
            float4 param_5 = ink;
            float param_6 = _159.uBarHeight * 0.550000011920928955078125;
            float param_7 = aspect * 0.89999997615814208984375;
            float2 param_8 = inkUV(param_4, param_5, param_6, param_7, uText, uTextSmplr);
            _786 = words(param_8, uText, uTextSmplr);
        }
        else
        {
            _786 = 0.0;
        }
        float w = _786;
        col = mix(col, mix(_159.uBar, float3(_159.uInk), float3(w)), float3(bar));
    }
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, bar));
}

fragment flair_triggered_frag_out flair_triggered_frag(constant FlairUniforms& _159 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uText [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uTextSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_triggered_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _844;
    if (_159.flair_flipY > 0.5)
    {
        _844 = _159.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _844 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _844);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _159, uText, uTextSmplr, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

