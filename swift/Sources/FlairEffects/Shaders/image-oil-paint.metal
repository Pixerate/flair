// flair-metal-hash: 1ba35a7a
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
    int uRadius;
    float uSharpness;
    float uSaturation;
    char _m16_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_oil_paint_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _59)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_59.uBackdrop) * _59.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_59.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 imageTap(thread const float2& uv, constant FlairUniforms& _59, texture2d<float> uImage, sampler uImageSmplr)
{
    float4 param = uImage.sample(uImageSmplr, uv);
    return overBackdrop(param, _59).xyz;
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
float3 cardTap(thread const float2& uv)
{
    float2 param = fract(uv);
    return testCard(param);
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _59)
{
    float4 _203;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _203 = overBackdrop(param, _59);
    }
    else
    {
        float2 param_1 = fract(uv);
        _203 = float4(testCard(param_1), 1.0);
    }
    return _203;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _59, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_59.iResolution[0], _59.iResolution[1]);
    float2 px = float2(1.0) / float2(_59.iResolution[0], _59.iResolution[1]);
    float3 m0;
    float3 m1;
    float3 m2;
    float3 m3;
    float3 s0;
    float3 s1;
    float3 s2;
    float3 s3;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        float2 param = uv;
        float3 c = imageTap(param, _59, uImage, uImageSmplr);
        float3 cc = c * c;
        m0 = c;
        m1 = c;
        m2 = c;
        m3 = c;
        s0 = cc;
        s1 = cc;
        s2 = cc;
        s3 = cc;
        for (int i = 1; i <= 8; i++)
        {
            if (i > _59.uRadius)
            {
                break;
            }
            float o = float(i);
            float2 param_1 = uv - float2(o * px.x, 0.0);
            c = imageTap(param_1, _59, uImage, uImageSmplr);
            cc = c * c;
            m0 += c;
            s0 += cc;
            m2 += c;
            s2 += cc;
            float2 param_2 = uv + float2(o * px.x, 0.0);
            c = imageTap(param_2, _59, uImage, uImageSmplr);
            cc = c * c;
            m1 += c;
            s1 += cc;
            m3 += c;
            s3 += cc;
            float2 param_3 = uv - float2(0.0, o * px.y);
            c = imageTap(param_3, _59, uImage, uImageSmplr);
            cc = c * c;
            m0 += c;
            s0 += cc;
            m1 += c;
            s1 += cc;
            float2 param_4 = uv + float2(0.0, o * px.y);
            c = imageTap(param_4, _59, uImage, uImageSmplr);
            cc = c * c;
            m2 += c;
            s2 += cc;
            m3 += c;
            s3 += cc;
        }
        for (int j = 1; j <= 8; j++)
        {
            if (j > _59.uRadius)
            {
                break;
            }
            for (int i_1 = 1; i_1 <= 8; i_1++)
            {
                if (i_1 > _59.uRadius)
                {
                    break;
                }
                float2 o_1 = float2(float(i_1), float(j)) * px;
                float2 param_5 = uv - o_1;
                c = imageTap(param_5, _59, uImage, uImageSmplr);
                m0 += c;
                s0 += (c * c);
                float2 param_6 = uv + float2(o_1.x, -o_1.y);
                c = imageTap(param_6, _59, uImage, uImageSmplr);
                m1 += c;
                s1 += (c * c);
                float2 param_7 = uv + float2(-o_1.x, o_1.y);
                c = imageTap(param_7, _59, uImage, uImageSmplr);
                m2 += c;
                s2 += (c * c);
                float2 param_8 = uv + o_1;
                c = imageTap(param_8, _59, uImage, uImageSmplr);
                m3 += c;
                s3 += (c * c);
            }
        }
    }
    else
    {
        float2 param_9 = uv;
        float3 c_1 = cardTap(param_9);
        float3 cc_1 = c_1 * c_1;
        m0 = c_1;
        m1 = c_1;
        m2 = c_1;
        m3 = c_1;
        s0 = cc_1;
        s1 = cc_1;
        s2 = cc_1;
        s3 = cc_1;
        for (int i_2 = 1; i_2 <= 8; i_2++)
        {
            if (i_2 > _59.uRadius)
            {
                break;
            }
            float o_2 = float(i_2);
            float2 param_10 = uv - float2(o_2 * px.x, 0.0);
            c_1 = cardTap(param_10);
            cc_1 = c_1 * c_1;
            m0 += c_1;
            s0 += cc_1;
            m2 += c_1;
            s2 += cc_1;
            float2 param_11 = uv + float2(o_2 * px.x, 0.0);
            c_1 = cardTap(param_11);
            cc_1 = c_1 * c_1;
            m1 += c_1;
            s1 += cc_1;
            m3 += c_1;
            s3 += cc_1;
            float2 param_12 = uv - float2(0.0, o_2 * px.y);
            c_1 = cardTap(param_12);
            cc_1 = c_1 * c_1;
            m0 += c_1;
            s0 += cc_1;
            m1 += c_1;
            s1 += cc_1;
            float2 param_13 = uv + float2(0.0, o_2 * px.y);
            c_1 = cardTap(param_13);
            cc_1 = c_1 * c_1;
            m2 += c_1;
            s2 += cc_1;
            m3 += c_1;
            s3 += cc_1;
        }
        for (int j_1 = 1; j_1 <= 8; j_1++)
        {
            if (j_1 > _59.uRadius)
            {
                break;
            }
            for (int i_3 = 1; i_3 <= 8; i_3++)
            {
                if (i_3 > _59.uRadius)
                {
                    break;
                }
                float2 o_3 = float2(float(i_3), float(j_1)) * px;
                float2 param_14 = uv - o_3;
                c_1 = cardTap(param_14);
                m0 += c_1;
                s0 += (c_1 * c_1);
                float2 param_15 = uv + float2(o_3.x, -o_3.y);
                c_1 = cardTap(param_15);
                m1 += c_1;
                s1 += (c_1 * c_1);
                float2 param_16 = uv + float2(-o_3.x, o_3.y);
                c_1 = cardTap(param_16);
                m2 += c_1;
                s2 += (c_1 * c_1);
                float2 param_17 = uv + o_3;
                c_1 = cardTap(param_17);
                m3 += c_1;
                s3 += (c_1 * c_1);
            }
        }
    }
    float n = float((_59.uRadius + 1) * (_59.uRadius + 1));
    m0 /= float3(n);
    m1 /= float3(n);
    m2 /= float3(n);
    m3 /= float3(n);
    float4 v = float4(dot(abs((s0 / float3(n)) - (m0 * m0)), float3(1.0)), dot(abs((s1 / float3(n)) - (m1 * m1)), float3(1.0)), dot(abs((s2 / float3(n)) - (m2 * m2)), float3(1.0)), dot(abs((s3 / float3(n)) - (m3 * m3)), float3(1.0)));
    float4 w = powr((v * 100.0) + float4(0.001000000047497451305389404296875), float4(-_59.uSharpness));
    float3 col = ((((m0 * w.x) + (m1 * w.y)) + (m2 * w.z)) + (m3 * w.w)) / float3(((w.x + w.y) + w.z) + w.w);
    float l = dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    col = mix(float3(l), col, float3(_59.uSaturation));
    float2 param_18 = uv;
    fragColor = float4(col, pictureRGBA(uImage, uImageSmplr, param_18, _59).w);
}

fragment flair_image_oil_paint_frag_out flair_image_oil_paint_frag(constant FlairUniforms& _59 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_oil_paint_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _894;
    if (_59.flair_flipY > 0.5)
    {
        _894 = _59.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _894 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _894);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _59, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

